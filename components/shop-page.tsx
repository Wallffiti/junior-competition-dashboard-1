"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser, getUserProfile } from "@/lib/authHelpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag,
  Upload,
  Loader2,
  Package,
  Minus,
  Plus,
  AlertCircle,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const TSHIRT_SIZES = [
  { value: "3xs", label: "3XS" },
  { value: "2xs", label: "2XS" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL" },
];

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  requires_size: boolean;
  pricing: {
    tier: string;
    single_price: number;
    team_price: number;
    past_participant_discount_pct: number;
    team_quantity: number;
  }[];
}

interface ShopConfig {
  shop_enabled: boolean;
  early_bird_end: string | null;
  standard_start: string | null;
  address_change_deadline: string | null;
}

interface TeamMember {
  name: string;
  size: string;
}

interface CartItem {
  productId: string;
  productName: string;
  orderType: "single" | "team";
  sizes: string[]; // one size per person
  names: string[]; // one name per person
  unitPrice: number;
  totalPrice: number;
  discount: number;
  quantity: number;
}

interface UserProfile {
  fullName: string;
  email: string;
  tshirtSize: string | null;
  mobile: string | null;
  parentMobile: string | null;
  schoolName: string | null;
  state: string | null;
  district: string | null;
  postcode: string | null;
  isTeacher: boolean;
  teamId: string;
  teamName: string;
}

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isPastParticipant, setIsPastParticipant] = useState(false);
  const [activeTier, setActiveTier] = useState<"early_bird" | "standard">(
    "standard"
  );
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Checkout form
  const [recipientName, setRecipientName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSlipFile, setPaymentSlipFile] = useState<File | null>(null);

  const { toast } = useToast();

  // Determine active competition year from env
  const competitionYear = parseInt(
    process.env.NEXT_PUBLIC_COMPETITION_YEAR || "2026",
    10
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1. Get user profile
      const email = await getAuthenticatedUser();
      if (!email) {
        setLoading(false);
        return;
      }

      const userProfile = await getUserProfile(email);
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        setRecipientName(userProfile.fullName);
        setMobileNumber(
          userProfile.mobile || userProfile.parentMobile || ""
        );
        const addr = [
          userProfile.schoolName,
          userProfile.district,
          userProfile.state,
          userProfile.postcode,
        ]
          .filter(Boolean)
          .join(", ");
        setDeliveryAddress(addr);
      }

      // Fetch team members (teacher + students) for size defaults
      if (userProfile?.teamId) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("teacherName, size, teamMembers")
          .eq("id", userProfile.teamId)
          .single();

        if (teamData) {
          const members: TeamMember[] = [];
          // Teacher first
          members.push({
            name: teamData.teacherName || "Teacher",
            size: teamData.size || "m",
          });
          // Students from JSONB
          if (Array.isArray(teamData.teamMembers)) {
            for (const m of teamData.teamMembers) {
              members.push({
                name: m.name || "Student",
                size: m.size || "m",
              });
            }
          }
          setTeamMembers(members);
        }
      }

      // 2. Check if past participant
      const { data: pastTeams } = await supabase
        .from("teams")
        .select("id")
        .or(
          `teacherEmail.ilike.${email},teamMembers.cs.[{"studentEmail":"${email}"}]`
        )
        .lt("competition_year", competitionYear)
        .limit(1);

      setIsPastParticipant(!!(pastTeams && pastTeams.length > 0));

      // 3. Fetch shop settings
      const { data: settings } = await supabase
        .from("shop_settings")
        .select("*")
        .eq("competition_year", competitionYear)
        .single();

      if (settings) {
        setConfig(settings);

        // Determine pricing tier
        const now = new Date();
        if (
          settings.early_bird_end &&
          now < new Date(settings.early_bird_end)
        ) {
          setActiveTier("early_bird");
        } else {
          setActiveTier("standard");
        }
      }

      // 4. Fetch products + pricing
      const { data: productsData } = await supabase
        .from("shop_products")
        .select("*")
        .eq("competition_year", competitionYear)
        .eq("is_active", true)
        .order("sort_order");

      if (productsData && productsData.length > 0) {
        const ids = productsData.map((p: any) => p.id);
        const { data: pricingData } = await supabase
          .from("shop_pricing")
          .select("*")
          .in("product_id", ids);

        const merged: Product[] = productsData.map((p: any) => ({
          ...p,
          pricing: (pricingData || []).filter(
            (pr: any) => pr.product_id === p.id
          ),
        }));
        setProducts(merged);
      }

      setLoading(false);
    };

    init();
  }, []);

  const getPricing = (product: Product) => {
    return product.pricing.find((p) => p.tier === activeTier);
  };

  const getDiscountedPrice = (singlePrice: number, discountPct: number) => {
    return singlePrice * (1 - discountPct / 100);
  };

  const addToCart = (
    product: Product,
    orderType: "single" | "team"
  ) => {
    const pricing = getPricing(product);
    if (!pricing) return;

    const defaultSize = profile?.tshirtSize || "m";
    const teamQty = pricing.team_quantity;

    let unitPrice: number;
    let totalPrice: number;
    let discount = 0;
    let sizes: string[];
    let quantity: number;

    let names: string[];

    if (orderType === "single") {
      unitPrice = pricing.single_price;
      quantity = 1;
      sizes = [defaultSize];
      names = [profile?.fullName || "Me"];

      if (isPastParticipant && pricing.past_participant_discount_pct > 0) {
        discount =
          unitPrice * (pricing.past_participant_discount_pct / 100);
        totalPrice = unitPrice - discount;
      } else {
        totalPrice = unitPrice;
      }
    } else {
      // Team package — no past participant discount on team
      unitPrice = pricing.team_price;
      quantity = teamQty;
      // Use actual team member names and sizes
      sizes = teamMembers.slice(0, teamQty).map((m) => m.size || "m");
      names = teamMembers.slice(0, teamQty).map((m) => m.name);
      // Pad if team has fewer members than teamQty
      while (sizes.length < teamQty) {
        sizes.push(defaultSize);
        names.push(`Member ${sizes.length}`);
      }
      totalPrice = unitPrice;
    }

    // Check if already in cart
    const existing = cart.find(
      (c) => c.productId === product.id && c.orderType === orderType
    );
    if (existing) {
      toast({
        title: "Already in cart",
        description: `${product.name} (${orderType}) is already in your cart.`,
      });
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        orderType,
        sizes,
        names,
        unitPrice,
        totalPrice,
        discount,
        quantity,
      },
    ]);

    toast({
      title: "Added to cart",
      description: `${product.name} (${orderType}) added.`,
    });
  };

  const removeFromCart = (productId: string, orderType: string) => {
    setCart((prev) =>
      prev.filter(
        (c) => !(c.productId === productId && c.orderType === orderType)
      )
    );
  };

  const updateCartSize = (
    productId: string,
    orderType: string,
    index: number,
    size: string
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && item.orderType === orderType) {
          const newSizes = [...item.sizes];
          newSizes[index] = size;
          return { ...item, sizes: newSizes };
        }
        return item;
      })
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartDiscount = cart.reduce((sum, item) => sum + item.discount, 0);

  const handleCheckout = async () => {
    if (!profile) return;
    if (!recipientName.trim() || !deliveryAddress.trim() || !mobileNumber.trim()) {
      toast({
        title: "Missing info",
        description: "Please fill in recipient name, delivery address and mobile number.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentSlipFile) {
      toast({
        title: "Payment slip required",
        description: "Please upload a payment slip for manual transfer.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Upload payment slip to Supabase Storage
      const fileExt = paymentSlipFile.name.split(".").pop();
      const filePath = `payment-slips/${profile.teamId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-slips")
        .upload(filePath, paymentSlipFile);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("payment-slips").getPublicUrl(filePath);

      // Create order for each cart item
      for (const item of cart) {
        const { data: order, error: orderError } = await supabase
          .from("shop_orders")
          .insert({
            user_email: profile.email,
            team_id: profile.teamId,
            competition_year: competitionYear,
            order_type: item.orderType,
            total_amount: item.totalPrice,
            discount_applied: item.discount,
            payment_method: "manual",
            payment_status: "pending",
            payment_slip_url: publicUrl,
            status: "pending_payment",
            recipient_name: recipientName.trim(),
            delivery_address: deliveryAddress.trim(),
            mobile_number: mobileNumber.trim(),
            address_change_deadline: config?.address_change_deadline || null,
          })
          .select("id")
          .single();

        if (orderError) throw new Error(`Order error: ${orderError.message}`);

        // Insert line items (one per size for team packages)
        const orderItems = item.sizes.map((size, idx) => ({
          order_id: order.id,
          product_id: item.productId,
          quantity: 1,
          tshirt_size: size,
          recipient_name:
            item.orderType === "team"
              ? item.names[idx] || `Member ${idx + 1}`
              : recipientName.trim(),
          unit_price:
            item.orderType === "team"
              ? item.unitPrice / item.quantity
              : item.totalPrice,
        }));

        const { error: itemsError } = await supabase
          .from("shop_order_items")
          .insert(orderItems);

        if (itemsError)
          throw new Error(`Order items error: ${itemsError.message}`);
      }

      toast({
        title: "Order placed!",
        description:
          "Your order has been submitted. We will confirm once payment is verified.",
      });

      setCart([]);
      setCheckoutOpen(false);
      setPaymentSlipFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config?.shop_enabled) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <ShoppingBag className="h-12 w-12 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-600">
            Shop is currently closed
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            The merchandise shop is not open yet. Please check back later!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Merchandise Shop
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Badge variant={activeTier === "early_bird" ? "default" : "secondary"}>
            {activeTier === "early_bird" ? "Early Bird Pricing" : "Standard Pricing"}
          </Badge>
          {isPastParticipant && (
            <Badge variant="outline" className="border-green-500 text-green-700">
              Past Participant — 10% off single packages
            </Badge>
          )}
          {config?.early_bird_end && activeTier === "early_bird" && (
            <span className="text-xs text-muted-foreground">
              Early bird ends:{" "}
              {new Date(config.early_bird_end).toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {products.map((product) => {
          const pricing = getPricing(product);
          if (!pricing) return null;

          const discountedSingle =
            isPastParticipant && pricing.past_participant_discount_pct > 0
              ? getDiscountedPrice(
                  pricing.single_price,
                  pricing.past_participant_discount_pct
                )
              : null;

          return (
            <Card key={product.id} className="overflow-hidden">
              {product.image_url && (
                <div className="h-48 bg-gray-100 flex items-center justify-center">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {product.name}
                </CardTitle>
                {product.description && (
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Single */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Single Package</p>
                    <div className="flex items-center gap-2">
                      {discountedSingle ? (
                        <>
                          <span className="text-lg font-bold text-green-700">
                            RM{discountedSingle.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            RM{pricing.single_price.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          RM{pricing.single_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">1 item</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product, "single")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {/* Team */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Team Package</p>
                    <span className="text-lg font-bold">
                      RM{pricing.team_price.toFixed(2)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {pricing.team_quantity} items
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product, "team")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Cart ({cart.length} item(s))</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.map((item) => (
              <div
                key={`${item.productId}-${item.orderType}`}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center">
                      {item.productName}
                      <Badge variant="outline" className="ml-2">
                        {item.orderType === "single"
                          ? "Single"
                          : "Team Package"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold">
                        RM{item.totalPrice.toFixed(2)}
                      </span>
                      {item.discount > 0 && (
                        <span className="text-xs text-green-600">
                          (Saved RM{item.discount.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      removeFromCart(item.productId, item.orderType)
                    }
                  >
                    <Minus className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {/* Size selectors */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    T-shirt Size(s)
                  </Label>
                  <div className={`grid gap-2 ${item.orderType === "team" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                    {item.sizes.map((size, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {item.orderType === "team" && (
                          <span className="text-xs text-muted-foreground min-w-[80px] truncate" title={item.names[idx]}>
                            {item.names[idx]}
                          </span>
                        )}
                        <Select
                          value={size}
                          onValueChange={(val) =>
                            updateCartSize(
                              item.productId,
                              item.orderType,
                              idx,
                              val
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TSHIRT_SIZES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                {cartDiscount > 0 && (
                  <p className="text-sm text-green-600">
                    Total discount: -RM{cartDiscount.toFixed(2)}
                  </p>
                )}
                <p className="text-xl font-bold">
                  Total: RM{cartTotal.toFixed(2)}
                </p>
              </div>
              <Button onClick={() => setCheckoutOpen(true)}>
                Proceed to Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              {cart.map((item) => (
                <div
                  key={`${item.productId}-${item.orderType}`}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.productName} ({item.orderType})
                  </span>
                  <span className="font-medium">
                    RM{item.totalPrice.toFixed(2)}
                  </span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>RM{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Delivery info */}
            <div className="space-y-3">
              <div>
                <Label>Recipient Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div>
                <Label>Delivery Address</Label>
                <Textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label>Mobile Number</Label>
                <Input
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="01x-xxxxxxx"
                />
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-2">
              <Label className="font-semibold">Payment Method</Label>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div className="text-sm">
                    <p className="font-medium">Bank Transfer / Online Banking</p>
                    <p className="text-muted-foreground">
                      Transfer to the account below, then upload your payment
                      slip.
                    </p>
                    <div className="mt-2 bg-blue-50 rounded p-2 text-xs space-y-1">
                      <p>
                        <strong>Bank:</strong> Will be provided by admin
                      </p>
                      <p>
                        <strong>Account:</strong> Will be provided by admin
                      </p>
                      <p>
                        <strong>Reference:</strong> {profile?.teamName}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Upload Payment Slip</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setPaymentSlipFile(e.target.files?.[0] || null)
                    }
                    className="mt-1"
                  />
                  {paymentSlipFile && (
                    <p className="text-xs text-green-600 mt-1">
                      {paymentSlipFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCheckout} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing order…
                </>
              ) : (
                "Place Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

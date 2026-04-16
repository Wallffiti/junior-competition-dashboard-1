"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/authHelpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  product_name: string;
  tshirt_size: string | null;
  recipient_name: string | null;
  unit_price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_type: "single" | "team";
  total_amount: number;
  discount_applied: number;
  payment_status: string;
  payment_method: string | null;
  status: string;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  recipient_name: string;
  delivery_address: string;
  mobile_number: string;
  created_at: string;
  items: OrderItem[];
}

const STATUS_STEPS = [
  { key: "pending_payment", label: "Pending Payment", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
];

const statusIndex = (status: string) =>
  STATUS_STEPS.findIndex((s) => s.key === status);

export function OrderTracker() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const competitionYear = parseInt(
    process.env.NEXT_PUBLIC_COMPETITION_YEAR || "2026",
    10
  );

  useEffect(() => {
    const fetchOrders = async () => {
      const email = await getAuthenticatedUser();
      if (!email) {
        setLoading(false);
        return;
      }

      // If redirected from Stripe with payment=success, verify pending orders first
      if (searchParams.get("payment") === "success") {
        // Get pending orders to verify
        const { data: pendingOrders } = await supabase
          .from("shop_orders")
          .select("id")
          .eq("user_email", email)
          .eq("competition_year", competitionYear)
          .eq("status", "pending_payment")
          .eq("payment_method", "stripe");

        if (pendingOrders && pendingOrders.length > 0) {
          try {
            await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderIds: pendingOrders.map((o: any) => o.id),
                userEmail: email,
              }),
            });
          } catch (err) {
            // Continue loading orders even if verification fails
          }
        }
      }

      const { data: ordersData } = await supabase
        .from("shop_orders")
        .select("*")
        .eq("user_email", email)
        .eq("competition_year", competitionYear)
        .order("created_at", { ascending: false });

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = ordersData.map((o: any) => o.id);
      const { data: itemsData } = await supabase
        .from("shop_order_items")
        .select("*")
        .in("order_id", orderIds);

      // Get product names
      const productIds = [
        ...new Set((itemsData || []).map((i: any) => i.product_id)),
      ];
      const { data: productsData } = await supabase
        .from("shop_products")
        .select("id, name")
        .in("id", productIds);

      const productMap = new Map(
        (productsData || []).map((p: any) => [p.id, p.name])
      );

      const merged: Order[] = ordersData.map((o: any) => ({
        ...o,
        items: (itemsData || [])
          .filter((i: any) => i.order_id === o.id)
          .map((i: any) => ({
            ...i,
            product_name: productMap.get(i.product_id) || "Unknown",
          })),
      }));

      setOrders(merged);
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const handleRetryPayment = async (order: Order) => {
    const email = await getAuthenticatedUser();
    if (!email) return;

    setRetryingOrderId(order.id);
    try {
      const res = await fetch("/api/checkout-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: [order.id],
          userEmail: email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment session");

      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setRetryingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Package className="h-12 w-12 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-600">No orders yet</h2>
          <p className="text-sm text-muted-foreground text-center">
            Visit the Shop to browse merchandise and place an order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="h-6 w-6" />
        My Orders
      </h1>

      {orders.map((order) => {
        const isCancelled = order.status === "cancelled";
        const currentIdx = statusIndex(order.status);

        return (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Order #{order.id.slice(0, 8)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {order.order_type === "single" ? "Single" : "Team Package"}
                  </Badge>
                  {isCancelled && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Cancelled
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Placed on{" "}
                {new Date(order.created_at).toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isCancelled && (
                <div className="flex items-center justify-between">
                  {STATUS_STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    const reached = idx <= currentIdx;
                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center flex-1"
                      >
                        <div className="relative flex items-center w-full justify-center">
                          {idx > 0 && (
                            <div
                              className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${
                                idx <= currentIdx
                                  ? "bg-green-500"
                                  : "bg-gray-200"
                              }`}
                            />
                          )}
                          {idx < STATUS_STEPS.length - 1 && (
                            <div
                              className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${
                                idx < currentIdx
                                  ? "bg-green-500"
                                  : "bg-gray-200"
                              }`}
                            />
                          )}
                          <div
                            className={`relative z-10 rounded-full p-1.5 ${
                              reached
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            <StepIcon className="h-4 w-4" />
                          </div>
                        </div>
                        <span
                          className={`text-[10px] mt-1 text-center ${
                            reached
                              ? "text-green-700 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pay Now button for pending Stripe orders */}
              {order.status === "pending_payment" &&
                order.payment_method === "stripe" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Payment incomplete</p>
                      <p className="text-xs text-yellow-600">Click to complete your payment.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRetryPayment(order)}
                      disabled={retryingOrderId === order.id}
                    >
                      {retryingOrderId === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-1" />
                      )}
                      Pay Now
                    </Button>
                  </div>
                )}

              {/* Tracking & Delivery */}
              {order.tracking_number && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p>
                    <strong>Tracking:</strong> {order.tracking_number}
                  </p>
                  {order.estimated_delivery_date && (
                    <p>
                      <strong>Est. Delivery:</strong>{" "}
                      {new Date(
                        order.estimated_delivery_date
                      ).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              )}

              <Separator />

              {/* Items */}
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      {item.tshirt_size && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {item.tshirt_size.toUpperCase()}
                        </Badge>
                      )}
                      {item.recipient_name && (
                        <span className="text-muted-foreground ml-2">
                          — {item.recipient_name}
                        </span>
                      )}
                    </div>
                    <span>RM{Number(item.unit_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {Number(order.discount_applied) > 0 && (
                    <span className="text-green-600">
                      Discount: -RM{Number(order.discount_applied).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="font-bold text-lg">
                  RM{Number(order.total_amount).toFixed(2)}
                </p>
              </div>

              {/* Delivery info */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Recipient:</strong> {order.recipient_name}
                </p>
                <p>
                  <strong>Address:</strong> {order.delivery_address}
                </p>
                <p>
                  <strong>Mobile:</strong> {order.mobile_number}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

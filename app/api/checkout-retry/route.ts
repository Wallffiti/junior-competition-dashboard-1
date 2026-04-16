import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { orderIds, userEmail } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "No order IDs" }, { status: 400 });
    }

    // Fetch orders and verify they belong to the user and are pending
    const { data: orders, error } = await supabase
      .from("shop_orders")
      .select("*, shop_order_items(*)")
      .in("id", orderIds)
      .eq("user_email", userEmail)
      .eq("payment_status", "pending")
      .eq("payment_method", "stripe");

    if (error || !orders || orders.length === 0) {
      return NextResponse.json(
        { error: "No pending Stripe orders found" },
        { status: 404 }
      );
    }

    // Fetch product names for line items
    const productIds = [
      ...new Set(
        orders.flatMap((o: any) =>
          (o.shop_order_items || []).map((i: any) => i.product_id)
        )
      ),
    ];
    const { data: products } = await supabase
      .from("shop_products")
      .select("id, name")
      .in("id", productIds);
    const productMap = new Map(
      (products || []).map((p: any) => [p.id, p.name])
    );

    // Build Stripe line items from the existing orders
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      orders.map((o: any) => ({
        price_data: {
          currency: "myr",
          product_data: {
            name: `${productMap.get((o.shop_order_items || [])[0]?.product_id) || "Merch"} (${o.order_type === "single" ? "Single" : "Team Package"})`,
          },
          unit_amount: Math.round(Number(o.total_amount) * 100),
        },
        quantity: 1,
      }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "fpx", "grabpay"],
      line_items: lineItems,
      mode: "payment",
      customer_email: userEmail,
      metadata: {
        order_ids: orders.map((o: any) => o.id).join(","),
        user_email: userEmail,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-orders?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-orders?payment=cancelled`,
    });

    // Update stripe_session_id on the orders
    for (const o of orders) {
      await supabase
        .from("shop_orders")
        .update({ stripe_session_id: session.id })
        .eq("id", o.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Retry checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

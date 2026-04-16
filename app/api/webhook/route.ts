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
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const orderIdsStr = session.metadata?.order_ids;
    if (!orderIdsStr) {
      console.error("No order_ids in session metadata");
      return NextResponse.json({ received: true });
    }

    const orderIds = orderIdsStr.split(",");

    // Mark orders as paid + confirmed
    for (const orderId of orderIds) {
      const { error } = await supabase
        .from("shop_orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          stripe_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        console.error(`Failed to update order ${orderId}:`, error.message);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderIdsStr = session.metadata?.order_ids;

    if (orderIdsStr) {
      const orderIds = orderIdsStr.split(",");
      for (const orderId of orderIds) {
        await supabase
          .from("shop_orders")
          .update({
            payment_status: "failed",
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }
    }
  }

  return NextResponse.json({ received: true });
}

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

    if (!orderIds || !Array.isArray(orderIds) || !userEmail) {
      return NextResponse.json(
        { error: "Missing orderIds or userEmail" },
        { status: 400 }
      );
    }

    // Fetch pending orders for this user
    const { data: orders, error } = await supabase
      .from("shop_orders")
      .select("id, stripe_session_id, status, payment_status")
      .in("id", orderIds)
      .eq("user_email", userEmail)
      .eq("status", "pending_payment");

    if (error || !orders || orders.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    let updated = 0;

    for (const order of orders) {
      if (!order.stripe_session_id) continue;

      try {
        // Check the actual payment status with Stripe
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_session_id
        );

        if (session.payment_status === "paid") {
          const { error: updateError } = await supabase
            .from("shop_orders")
            .update({
              payment_status: "paid",
              status: "confirmed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          if (!updateError) updated++;
        }
      } catch (stripeErr: any) {
        console.error(
          `Failed to verify session for order ${order.id}:`,
          stripeErr.message
        );
      }
    }

    return NextResponse.json({ updated });
  } catch (err: any) {
    console.error("Verify payment error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

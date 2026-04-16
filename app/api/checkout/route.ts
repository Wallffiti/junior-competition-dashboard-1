import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-03-31.basil",
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const supabase = getSupabase();
    const body = await req.json();
    const {
      cart,
      userEmail,
      teamId,
      competitionYear,
      recipientName,
      deliveryAddress,
      mobileNumber,
      addressChangeDeadline,
    } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!userEmail || !recipientName || !deliveryAddress || !mobileNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create orders in DB first (pending_payment status)
    const orderIds: string[] = [];

    for (const item of cart) {
      const { data: order, error: orderError } = await supabase
        .from("shop_orders")
        .insert({
          user_email: userEmail,
          team_id: teamId || null,
          competition_year: competitionYear,
          order_type: item.orderType,
          total_amount: item.totalPrice,
          discount_applied: item.discount,
          payment_method: "stripe",
          payment_status: "pending",
          status: "pending_payment",
          recipient_name: recipientName,
          delivery_address: deliveryAddress,
          mobile_number: mobileNumber,
          address_change_deadline: addressChangeDeadline || null,
        })
        .select("id")
        .single();

      if (orderError) {
        return NextResponse.json(
          { error: `Order creation failed: ${orderError.message}` },
          { status: 500 }
        );
      }

      orderIds.push(order.id);

      // Insert line items
      const orderItems = item.sizes.map((size: string, idx: number) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: 1,
        tshirt_size: size,
        recipient_name:
          item.orderType === "team"
            ? item.names?.[idx] || `Member ${idx + 1}`
            : recipientName,
        unit_price:
          item.orderType === "team"
            ? item.unitPrice / item.quantity
            : item.totalPrice,
      }));

      const { error: itemsError } = await supabase
        .from("shop_order_items")
        .insert(orderItems);

      if (itemsError) {
        return NextResponse.json(
          { error: `Order items failed: ${itemsError.message}` },
          { status: 500 }
        );
      }
    }

    // Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      cart.map((item: any) => ({
        price_data: {
          currency: "myr",
          product_data: {
            name: `${item.productName} (${item.orderType === "single" ? "Single" : "Team Package"})`,
          },
          unit_amount: Math.round(item.totalPrice * 100), // cents
        },
        quantity: 1,
      }));

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "fpx", "grabpay"],
      line_items: lineItems,
      mode: "payment",
      customer_email: userEmail,
      metadata: {
        order_ids: orderIds.join(","),
        user_email: userEmail,
        team_id: teamId || "",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-orders?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/shop?payment=cancelled`,
    });

    // Store stripe_session_id on orders
    for (const orderId of orderIds) {
      await supabase
        .from("shop_orders")
        .update({ stripe_session_id: session.id })
        .eq("id", orderId);
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

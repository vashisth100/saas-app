import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add webhook secret in env file");
  }

 
  const headerPayload = headers();

  const svixId = (await headerPayload).get("svix-id");
  const svixTimestamp = (await headerPayload).get("svix-timestamp");
  const svixSignature = (await headerPayload).get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Error occurred - No Svix Headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying Webhook", err);
    return new Response("Error verifying webhook", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    try {
      const { email_addresses, primary_email_address_id } = evt.data;

      const primaryEmail = email_addresses.find(
        (email: { id: string; email_address: string }) =>
          email.id === primary_email_address_id
      );

      if (!primaryEmail) {
        return new Response("No Primary Email Found", { status: 400 });
      }

      //  Creating a user in Neon (PostgreSQL)
      const newUser = await prisma.user.create({
        data: {
          id: evt.data.id!,
          email: primaryEmail.email_address,
          isSubscribed: false,
        },
      });

      console.log("New user created", newUser);
    } catch (error) {
      console.error("Error creating user in Database", error);
      return new Response("Error creating user in Database", { status: 500 });
    }
  }

  return new Response("Webhook received successfully", { status: 200 });
}

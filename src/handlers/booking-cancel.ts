import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

registerMainMenuItem({ label: "❌ Cancel Booking", data: "booking:cancel", order: 40 });

const ASK_REF = "Please enter your booking reference code:";
const CONFIRM_CANCEL = (ref: string) => `Cancel booking ${ref}?`;
const CANCEL_SUCCESS = (ref: string) => `Booking ${ref} has been cancelled. We're sorry to see you go.`;
const NOT_FOUND = "No booking found with that reference. Please check and try again.";
const ALREADY_CANCELED = "That booking is already cancelled.";

const composer = new Composer<Ctx>();

composer.callbackQuery("booking:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "cancel_ref";
  await ctx.reply(ASK_REF, {
    reply_markup: { force_reply: true, selective: false },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.bookingStep !== "cancel_ref") return next();
  const ref = ctx.message.text.trim().toUpperCase();
  const store = getDomainStore();
  const booking = store.getBookingByRef(ref);

  if (!booking) {
    await ctx.reply(NOT_FOUND);
    return;
  }
  if (booking.status === "canceled") {
    await ctx.reply(ALREADY_CANCELED);
    ctx.session.bookingStep = "idle";
    return;
  }

  ctx.session.bookingStep = "idle";
  store.updateBooking(booking.id, { status: "canceled" });

  await ctx.reply(CANCEL_SUCCESS(ref), {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;

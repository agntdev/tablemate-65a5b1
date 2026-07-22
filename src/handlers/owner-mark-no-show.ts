import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

const ASK_REF = "Enter the booking reference to mark as no-show:";
const NOT_FOUND = "No booking found with that reference.";
const ALREADY_CANCELED = "That booking is already cancelled.";
const MARKED_NO_SHOW = (ref: string) => `Booking ${ref} marked as no-show.`;

const composer = new Composer<Ctx>();

composer.callbackQuery("owner:mark_no_show", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "no_show_ref";
  await ctx.reply(ASK_REF);
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.bookingStep !== "no_show_ref") return next();
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

  store.updateBooking(booking.id, { status: "no_show" });
  ctx.session.bookingStep = "idle";

  await ctx.reply(MARKED_NO_SHOW(ref), {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;

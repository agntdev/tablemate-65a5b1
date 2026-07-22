import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

const NO_BOOKINGS = "No upcoming bookings yet.";

function formatBooking(b: { refCode: string; guestName?: string; partySize: number; date: string; time: string; status: string }): string {
  const name = b.guestName || "Guest";
  const statusEmoji = b.status === "confirmed" ? "✅" : b.status === "rescheduled" ? "🔄" : "";
  return `${statusEmoji} ${b.refCode} — ${name}, ${b.partySize} guests, ${b.date} ${b.time}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("owner:view_bookings", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStore();
  const bookings = store.getUpcomingBookings();

  if (bookings.length === 0) {
    await ctx.editMessageText(NO_BOOKINGS, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "owner:back")]]),
    });
    return;
  }

  const lines = bookings.map(formatBooking);
  const text = `Upcoming bookings (${bookings.length}):\n\n${lines.join("\n")}`;

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "owner:back")]]),
  });
});

export default composer;

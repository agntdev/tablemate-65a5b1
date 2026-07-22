import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("owner:view_capacity", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStore();
  const today = new Date().toISOString().split("T")[0];
  const bookings = store.getBookingsForDate(today);

  const tables = store.getTables();
  const plan = store.getSeatingPlan(new Date(today + "T00:00:00").getDay());
  const maxCovers = plan?.maxCovers ?? 50;

  let totalBooked = 0;
  for (const b of bookings) totalBooked += b.partySize;

  const remaining = Math.max(0, maxCovers - totalBooked);

  const lines = [
    `Today's capacity (${today}):`,
    ``,
    `Booked: ${totalBooked} guests (${bookings.length} reservations)`,
    `Remaining: ${remaining} of ${maxCovers} seats`,
  ];

  if (tables.length > 0) {
    lines.push(``, `Tables:`);
    for (const t of tables) {
      lines.push(`  ${t.seats} seats × ${t.quantity}`);
    }
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "owner:back")]]),
  });
});

export default composer;

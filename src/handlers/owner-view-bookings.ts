import { Composer } from "grammy";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "View Upcoming Bookings", data: "owner:view_bookings" }) if the toolkit exposes it.

const composer = new Composer();

composer.callbackQuery("owner:view_bookings", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Displays all upcoming bookings to the owner");
});

export default composer;

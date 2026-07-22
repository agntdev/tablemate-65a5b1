import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

const OWNER_MENU = "Owner menu — what would you like to do?";

const composer = new Composer<Ctx>();

composer.command("owner", async (ctx) => {
  const store = getDomainStore();
  if (ctx.from?.id) store.setOwnerChatId(ctx.from.id);

  await ctx.reply(OWNER_MENU, {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 View bookings", "owner:view_bookings")],
      [inlineButton("📊 Today's capacity", "owner:view_capacity")],
      [inlineButton("🚫 Mark no-show", "owner:mark_no_show")],
      [inlineButton("⚙️ Settings", "owner:settings")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("owner:settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStore();
  const settings = store.getOwnerSettings();
  await ctx.editMessageText(
    `Settings:\n\n⏰ Reminder: ${settings.reminderHoursBefore}h before booking\n📅 Retention: ${settings.dataRetentionDays} days`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⏰ Reminder", "owner:set_reminder")],
        [inlineButton("⬅️ Back", "owner:back")],
      ]),
    },
  );
});

composer.callbackQuery("owner:set_reminder", async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = [];
  for (const h of [1, 2, 3, 6, 12, 24]) {
    rows.push([inlineButton(`${h} hour${h > 1 ? "s" : ""} before`, `owner:rem:${h}`)]);
  }
  rows.push([inlineButton("⬅️ Back", "owner:back")]);
  await ctx.editMessageText("How long before the booking should we remind guests?", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^owner:rem:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const hours = parseInt(ctx.match[1], 10);
  const store = getDomainStore();
  store.updateOwnerSettings({ reminderHoursBefore: hours });
  await ctx.editMessageText(`Reminder set to ${hours} hour${hours > 1 ? "s" : ""} before booking.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "owner:back")]]),
  });
});

composer.callbackQuery("owner:back", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(OWNER_MENU, {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 View bookings", "owner:view_bookings")],
      [inlineButton("📊 Today's capacity", "owner:view_capacity")],
      [inlineButton("🚫 Mark no-show", "owner:mark_no_show")],
      [inlineButton("⚙️ Settings", "owner:settings")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;

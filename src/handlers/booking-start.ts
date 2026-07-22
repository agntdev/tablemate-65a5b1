import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

registerMainMenuItem({ label: "📅 Book a Table", data: "booking:start", order: 10 });

const WELCOME = "Welcome! I'll help you book a table. Let's get started.";
const ASK_NAME = "What name should the reservation be under? (Or tap Skip to skip.)";
const ASK_PHONE = "Got it. What's a phone number we can reach you at? (Or tap Skip to skip.)";
const ASK_DATE = "Great! Pick a date for your reservation:";
const ASK_TIME = "Now pick a time:";
const ASK_PARTY_SIZE = "How many guests?";
const NO_AVAILABILITY = "Sorry, no tables are available for that date. Try another day?";
const TIME_SLOT_FULL = "That time slot is full. Pick a different time:";
const PARTY_TOO_LARGE = "That party is too large for our capacity. Try a smaller group?";
const CONFIRM_BOOKING = (refCode: string, name: string, date: string, time: string, partySize: number) =>
  `Your table is booked!\n\nRef: ${refCode}\nName: ${name}\nDate: ${date}\nTime: ${time}\nParty: ${partySize} guests\n\nShow this code when you arrive.`;
const CANCEL = "Booking cancelled. Tap /start to try again.";

function getNext14Days(now: Date): { label: string; data: string }[] {
  const days: { label: string; data: string }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = dayNames[d.getDay()];
    const label = i === 0 ? `Today (${dayName})` : i === 1 ? `Tomorrow (${dayName})` : `${dayName} ${d.getDate()}`;
    days.push({ label, data: `book:date:${dateStr}` });
  }
  return days;
}

function getTimeSlots(openTime: string, closeTime: string, durationMinutes: number): { label: string; data: string }[] {
  const slots: { label: string; data: string }[] = [];
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  let t = oh * 60 + om;
  const end = ch * 60 + cm;
  while (t + durationMinutes <= end) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const label = `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    slots.push({ label, data: `book:time:${timeStr}` });
    t += 30;
  }
  return slots;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("booking:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "greeting";
  ctx.session.bookingFlow = {};
  await ctx.reply(WELCOME, {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "book:skip_name"), inlineButton("Cancel", "book:cancel_flow")]]),
  });
});

composer.callbackQuery("book:cancel_flow", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "idle";
  ctx.session.bookingFlow = undefined;
  await ctx.reply(CANCEL);
});

composer.callbackQuery("book:skip_name", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "phone";
  await ctx.reply(ASK_PHONE, {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "book:skip_phone"), inlineButton("Cancel", "book:cancel_flow")]]),
  });
});

composer.callbackQuery(/^book:date:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const date = ctx.match[1];
  const store = getDomainStore();
  const plan = store.getSeatingPlan(new Date(date + "T00:00:00").getDay());
  if (!plan) {
    await ctx.reply(NO_AVAILABILITY, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "booking:start")]]),
    });
    return;
  }
  ctx.session.bookingFlow!.date = date;
  ctx.session.bookingStep = "time";

  const slots = getTimeSlots(plan.openTime, plan.closeTime, plan.sittingDurationMinutes);
  const partySize = ctx.session.bookingFlow!.partySize ?? 2;
  const available = slots.filter((s) => {
    const time = s.data.split(":")[2] + ":" + s.data.split(":")[3];
    return store.canAccommodate(partySize, date, time);
  });

  if (available.length === 0) {
    ctx.session.bookingStep = "date";
    await ctx.reply(NO_AVAILABILITY, {
      reply_markup: inlineKeyboard([
        ...getNext14Days(new Date()).map((d) => [inlineButton(d.label, d.data)]),
        [inlineButton("Cancel", "book:cancel_flow")],
      ]),
    });
    return;
  }

  await ctx.reply(ASK_TIME, {
    reply_markup: inlineKeyboard([
      ...available.map((s) => [inlineButton(s.label, s.data)]),
      [inlineButton("Cancel", "book:cancel_flow")],
    ]),
  });
});

composer.callbackQuery(/^book:time:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match[1];
  ctx.session.bookingFlow!.time = time;
  ctx.session.bookingStep = "party_size";

  const rows = [];
  for (let i = 1; i <= 10; i++) {
    rows.push([inlineButton(`${i} guest${i > 1 ? "s" : ""}`, `book:party:${i}`)]);
  }
  rows.push([inlineButton("Cancel", "book:cancel_flow")]);

  await ctx.reply(ASK_PARTY_SIZE, { reply_markup: inlineKeyboard(rows) });
});

composer.callbackQuery(/^book:party:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const partySize = parseInt(ctx.match[1], 10);
  const store = getDomainStore();
  const { date, time } = ctx.session.bookingFlow!;

  if (!store.canAccommodate(partySize, date!, time!)) {
    await ctx.reply(PARTY_TOO_LARGE);
    return;
  }

  ctx.session.bookingFlow!.partySize = partySize;
  ctx.session.bookingStep = "confirm";

  const name = ctx.session.bookingFlow!.name || "Guest";
  const phone = ctx.session.bookingFlow!.phone || "—";

  await ctx.reply(
    `Please confirm your booking:\n\nName: ${name}\nPhone: ${phone}\nDate: ${date}\nTime: ${time}\nParty: ${partySize} guests`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Confirm", "book:confirm"), inlineButton("Cancel", "book:cancel_flow")],
      ]),
    },
  );
});

composer.callbackQuery("book:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStore();
  const flow = ctx.session.bookingFlow!;
  const refCode = store.generateRefCode();
  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  store.addBooking({
    id: bookingId,
    refCode,
    guestName: flow.name,
    guestPhone: flow.phone,
    guestUserId: ctx.from?.id,
    partySize: flow.partySize!,
    date: flow.date!,
    time: flow.time!,
    status: "confirmed",
    createdAt: Date.now(),
  });

  if (ctx.from?.id) {
    store.addUserBooking(ctx.from.id, bookingId);
  }

  ctx.session.bookingStep = "idle";
  ctx.session.bookingFlow = undefined;

  await ctx.reply(
    CONFIRM_BOOKING(refCode, flow.name || "Guest", flow.date!, flow.time!, flow.partySize!),
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.bookingStep;
  if (step === "name") {
    const name = ctx.message.text.trim();
    if (name.length < 1) {
      await ctx.reply("Please enter a name, or tap Skip.");
      return;
    }
    ctx.session.bookingFlow!.name = name;
    ctx.session.bookingStep = "phone";
    await ctx.reply(ASK_PHONE, {
      reply_markup: inlineKeyboard([[inlineButton("Skip", "book:skip_phone"), inlineButton("Cancel", "book:cancel_flow")]]),
    });
    return;
  }
  if (step === "phone") {
    const phone = ctx.message.text.trim();
    if (phone.length < 1) {
      await ctx.reply("Please enter a phone number, or tap Skip.");
      return;
    }
    ctx.session.bookingFlow!.phone = phone;
    ctx.session.bookingStep = "date";
    const now = new Date();
    await ctx.reply(ASK_DATE, {
      reply_markup: inlineKeyboard([
        ...getNext14Days(now).map((d) => [inlineButton(d.label, d.data)]),
        [inlineButton("Cancel", "book:cancel_flow")],
      ]),
    });
    return;
  }
  if (step === "greeting") {
    const text = ctx.message.text.trim();
    if (text.toLowerCase() === "skip") {
      ctx.session.bookingStep = "phone";
      await ctx.reply(ASK_PHONE, {
        reply_markup: inlineKeyboard([[inlineButton("Skip", "book:skip_phone"), inlineButton("Cancel", "book:cancel_flow")]]),
      });
      return;
    }
    ctx.session.bookingFlow!.name = text;
    ctx.session.bookingStep = "phone";
    await ctx.reply(ASK_PHONE, {
      reply_markup: inlineKeyboard([[inlineButton("Skip", "book:skip_phone"), inlineButton("Cancel", "book:cancel_flow")]]),
    });
    return;
  }
  return next();
});

composer.callbackQuery("book:skip_phone", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "date";
  const now = new Date();
  await ctx.reply(ASK_DATE, {
    reply_markup: inlineKeyboard([
      ...getNext14Days(now).map((d) => [inlineButton(d.label, d.data)]),
      [inlineButton("Cancel", "book:cancel_flow")],
    ]),
  });
});

export default composer;

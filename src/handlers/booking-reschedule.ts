import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStore } from "../domain-store.js";

registerMainMenuItem({ label: "🔄 Reschedule", data: "booking:reschedule", order: 30 });

const ASK_REF = "Please enter your booking reference code to reschedule:";
const NOT_FOUND = "No booking found with that reference. Please check and try again.";
const ALREADY_CANCELED = "That booking is cancelled and can't be rescheduled. Book a new one instead.";
const ASK_NEW_DATE = "Pick a new date:";
const ASK_NEW_TIME = "Pick a new time:";
const RESCHEDULE_CONFIRMED = (ref: string, date: string, time: string) =>
  `Booking ${ref} rescheduled to ${date} at ${time}.`;
const NO_AVAILABILITY = "Sorry, no tables are available for that date. Try another day?";
const PARTY_TOO_LARGE = "That party is too large for our capacity. Try a smaller group?";
const CANCEL = "Reschedule cancelled. Tap /start to try again.";

function getNext14Days(now: Date): { label: string; data: string }[] {
  const days: { label: string; data: string }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = dayNames[d.getDay()];
    const label = i === 0 ? `Today (${dayName})` : i === 1 ? `Tomorrow (${dayName})` : `${dayName} ${d.getDate()}`;
    days.push({ label, data: `rdate:${dateStr}` });
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
    slots.push({ label, data: `rtime:${timeStr}` });
    t += 30;
  }
  return slots;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("booking:reschedule", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "reschedule_ref";
  await ctx.reply(ASK_REF, {
    reply_markup: { force_reply: true, selective: false },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.bookingStep !== "reschedule_ref") return next();
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

  ctx.session.rescheduleFlow = {
    bookingId: booking.id,
    refCode: ref,
    partySize: booking.partySize,
  };
  ctx.session.bookingStep = "reschedule_date";

  const now = new Date();
  await ctx.reply(ASK_NEW_DATE, {
    reply_markup: inlineKeyboard([
      ...getNext14Days(now).map((d) => [inlineButton(d.label, d.data)]),
      [inlineButton("Cancel", "book:cancel_flow")],
    ]),
  });
});

composer.callbackQuery(/^rdate:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const date = ctx.match[1];
  const store = getDomainStore();
  const plan = store.getSeatingPlan(new Date(date + "T00:00:00").getDay());

  if (!plan) {
    ctx.session.bookingStep = "reschedule_date";
    await ctx.reply(NO_AVAILABILITY, {
      reply_markup: inlineKeyboard([
        ...getNext14Days(new Date()).map((d) => [inlineButton(d.label, d.data)]),
        [inlineButton("Cancel", "book:cancel_flow")],
      ]),
    });
    return;
  }

  ctx.session.rescheduleFlow!.date = date;
  ctx.session.bookingStep = "reschedule_time";

  const slots = getTimeSlots(plan.openTime, plan.closeTime, plan.sittingDurationMinutes);
  const partySize = ctx.session.rescheduleFlow!.partySize ?? 2;
  const available = slots.filter((s) => {
    const time = s.data.split(":")[1];
    return store.canAccommodate(partySize, date, time);
  });

  if (available.length === 0) {
    ctx.session.bookingStep = "reschedule_date";
    await ctx.reply(NO_AVAILABILITY, {
      reply_markup: inlineKeyboard([
        ...getNext14Days(new Date()).map((d) => [inlineButton(d.label, d.data)]),
        [inlineButton("Cancel", "book:cancel_flow")],
      ]),
    });
    return;
  }

  await ctx.reply(ASK_NEW_TIME, {
    reply_markup: inlineKeyboard([
      ...available.map((s) => [inlineButton(s.label, s.data)]),
      [inlineButton("Cancel", "book:cancel_flow")],
    ]),
  });
});

composer.callbackQuery(/^rtime:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match[1];
  const store = getDomainStore();
  const flow = ctx.session.rescheduleFlow!;

  store.updateBooking(flow.bookingId!, {
    date: flow.date!,
    time,
    status: "rescheduled",
  });

  ctx.session.bookingStep = "idle";
  ctx.session.rescheduleFlow = undefined;

  await ctx.reply(RESCHEDULE_CONFIRMED(flow.refCode!, flow.date!, time), {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;

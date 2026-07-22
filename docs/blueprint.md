# TableReserve Bot — Bot specification

**Archetype:** booking

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for restaurant guests to book tables and for owners to manage reservations. Guests select available slots, receive confirmation codes, and get reminders. Owners configure inventory, view bookings, and track capacity.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Restaurant guests
- Restaurant owners and staff

## Success criteria

- Guests can book available slots without overbooking
- Owners can configure and manage reservations effectively
- Reminders are sent to guests before their reservation time

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu for guests or owner login
- **Book a Table** (button, actor: user, callback: booking:start) — Initiates the booking flow for guests
  - inputs: name (optional), phone (optional), date, time, party size
  - outputs: booking confirmation with reference code
- **Reschedule** (button, actor: user, callback: booking:reschedule) — Allows guests to reschedule an existing booking
  - inputs: booking reference code, new date, new time
  - outputs: updated booking confirmation
- **Cancel Booking** (button, actor: user, callback: booking:cancel) — Allows guests to cancel a booking
  - inputs: booking reference code
  - outputs: cancellation confirmation
- **/owner** (command, actor: user, command: /owner) — Opens owner/staff interface for managing bookings and settings
- **View Upcoming Bookings** (button, actor: user, callback: owner:view_bookings) — Displays all upcoming bookings to the owner
  - inputs: none
  - outputs: list of upcoming bookings
- **Today's Capacity** (button, actor: user, callback: owner:view_capacity) — Shows today's remaining capacity to the owner
  - inputs: none
  - outputs: capacity summary
- **Mark No-Show** (button, actor: user, callback: owner:mark_no_show) — Allows owner to mark a booking as no-show
  - inputs: booking reference code
  - outputs: no-show confirmation

## Flows

### Guest Booking Flow
_Trigger:_ /start or /booking:start

1. Greet guest and ask for optional name/phone
2. Show available dates (next 14 days)
3. Select time slot based on availability
4. Choose party size with table combination logic
5. Confirm booking with reference code
6. Send reminder X hours before booking

_Data touched:_ Booking

### Owner Management Flow
_Trigger:_ /owner

1. Authenticate owner
2. Display main owner menu
3. View upcoming bookings
4. View today's capacity
5. Mark bookings as no-show

_Data touched:_ Booking, Table inventory, Seating plan

### Reschedule Flow
_Trigger:_ /booking:reschedule or button

1. Verify booking reference code
2. Repeat date/time selection with same party size
3. Update booking details

_Data touched:_ Booking

### Cancel Flow
_Trigger:_ /booking:cancel or button

1. Verify booking reference code
2. Mark booking as canceled
3. Send cancellation confirmation

_Data touched:_ Booking

### Reminder Flow
_Trigger:_ Scheduled task X hours before booking

1. Send reminder message to guest with booking details

_Data touched:_ Booking

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Booking** _(retention: persistent)_ — A guest reservation with date, time, party size, and status
  - fields: guest name (optional), phone (optional), party size, date/time, reference code, status (confirmed, rescheduled, canceled, no-show)
- **Table inventory** _(retention: persistent)_ — Table types and quantities available for booking
  - fields: table type (seats), quantity
- **Seating plan** _(retention: persistent)_ — Opening hours, sitting duration, and max simultaneous covers
  - fields: weekday, open time, close time, sitting duration, max simultaneous covers

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure opening hours
- Set table inventory
- View upcoming bookings
- View today's remaining capacity
- Mark bookings as no-show
- Set reminder timing
- Configure data retention policy

## Notifications

- New booking notification to owner
- Daily summary to owner
- Reminder to guest before booking
- Cancellation confirmation to guest
- Reschedule confirmation to guest
- No-show flag confirmation to owner

## Permissions & privacy

- Guest personal data (name/phone) only shown to owner in owner view
- Guest data deleted on cancellation or after retention period
- Owner must authenticate to access management features

## Edge cases

- Party size exceeding single-table capacity but possible with table combination
- Multiple guests trying to book same time slot simultaneously
- Owner tries to mark a canceled booking as no-show
- Guest tries to book outside of opening hours
- Guest tries to reschedule to a full time slot

## Required tests

- End-to-end guest booking flow with availability checks
- Owner management interface functionality
- Reminder message delivery timing
- Table combination logic for large parties
- No-show marking functionality
- Data retention policy enforcement

## Assumptions

- Owner will set opening hours and table inventory before guests can book
- Guests will have Telegram and understand basic bot interactions
- Restaurant has consistent seating plan across days
- Owner will manually handle no-shows rather than automatic system flags

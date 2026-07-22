export interface Booking {
  id: string;
  refCode: string;
  guestName?: string;
  guestPhone?: string;
  guestUserId?: number;
  partySize: number;
  date: string;
  time: string;
  status: "confirmed" | "rescheduled" | "canceled" | "no_show";
  createdAt: number;
}

export interface Table {
  id: string;
  seats: number;
  quantity: number;
}

export interface SeatingPlan {
  weekday: number;
  openTime: string;
  closeTime: string;
  sittingDurationMinutes: number;
  maxCovers: number;
}

export interface OwnerSettings {
  reminderHoursBefore: number;
  dataRetentionDays: number;
}

export class DomainStore {
  private bookings = new Map<string, Booking>();
  private tables = new Map<string, Table>();
  private seatingPlans = new Map<string, SeatingPlan>();
  private ownerSettings: OwnerSettings = { reminderHoursBefore: 2, dataRetentionDays: 90 };
  private ownerChatId?: number;

  setOwnerChatId(id: number): void {
    this.ownerChatId = id;
  }

  getOwnerChatId(): number | undefined {
    return this.ownerChatId;
  }

  addBooking(b: Booking): void {
    this.bookings.set(b.id, b);
  }

  getBooking(id: string): Booking | undefined {
    return this.bookings.get(id);
  }

  getBookingByRef(refCode: string): Booking | undefined {
    for (const b of this.bookings.values()) {
      if (b.refCode === refCode) return b;
    }
    return undefined;
  }

  updateBooking(id: string, updates: Partial<Booking>): void {
    const b = this.bookings.get(id);
    if (b) Object.assign(b, updates);
  }

  getUpcomingBookings(): Booking[] {
    const result: Booking[] = [];
    for (const b of this.bookings.values()) {
      if (b.status === "confirmed" || b.status === "rescheduled") {
        result.push(b);
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }

  getBookingsForDate(date: string): Booking[] {
    const result: Booking[] = [];
    for (const b of this.bookings.values()) {
      if (b.date === date && (b.status === "confirmed" || b.status === "rescheduled")) {
        result.push(b);
      }
    }
    return result;
  }

  getBookingsForSlot(date: string, time: string): Booking[] {
    const result: Booking[] = [];
    for (const b of this.bookings.values()) {
      if (b.date === date && b.time === time && (b.status === "confirmed" || b.status === "rescheduled")) {
        result.push(b);
      }
    }
    return result;
  }

  addUserBooking(userId: number, bookingId: string): void {
    const key = `user_bookings:${userId}`;
    const existing = this.bookings.get(key);
    if (existing && typeof existing === "object" && "ids" in existing) {
      (existing as unknown as { ids: string[] }).ids.push(bookingId);
    } else {
      this.bookings.set(key, { id: key, refCode: "", partySize: 0, date: "", time: "", status: "confirmed", createdAt: 0, ids: [bookingId] } as unknown as Booking);
    }
  }

  getUserBookingIds(userId: number): string[] {
    const key = `user_bookings:${userId}`;
    const entry = this.bookings.get(key);
    if (entry && typeof entry === "object" && "ids" in entry) {
      return (entry as unknown as { ids: string[] }).ids;
    }
    return [];
  }

  addTable(t: Table): void {
    this.tables.set(t.id, t);
  }

  getTables(): Table[] {
    return [...this.tables.values()];
  }

  setSeatingPlan(p: SeatingPlan): void {
    this.seatingPlans.set(`${p.weekday}`, p);
  }

  getSeatingPlan(weekday: number): SeatingPlan | undefined {
    return this.seatingPlans.get(`${weekday}`);
  }

  getSeatingPlans(): SeatingPlan[] {
    return [...this.seatingPlans.values()];
  }

  getOwnerSettings(): OwnerSettings {
    return { ...this.ownerSettings };
  }

  updateOwnerSettings(updates: Partial<OwnerSettings>): void {
    Object.assign(this.ownerSettings, updates);
  }

  canAccommodate(partySize: number, date: string, time: string): boolean {
    const booked = this.getBookingsForSlot(date, time);
    let totalBookedCovers = 0;
    for (const b of booked) totalBookedCovers += b.partySize;

    const plan = this.getSeatingPlan(new Date(date + "T00:00:00").getDay());
    const maxCovers = plan?.maxCovers ?? 50;

    if (totalBookedCovers + partySize > maxCovers) return false;

    const tables = this.getTables();
    if (tables.length === 0) return partySize <= maxCovers;

    const availableSeats = maxCovers - totalBookedCovers;
    return partySize <= availableSeats;
  }

  generateRefCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  clear(): void {
    this.bookings.clear();
    this.tables.clear();
    this.seatingPlans.clear();
    this.ownerSettings = { reminderHoursBefore: 2, dataRetentionDays: 90 };
    this.ownerChatId = undefined;
  }
}

let _instance: DomainStore | null = null;

export function getDomainStore(): DomainStore {
  if (!_instance) _instance = new DomainStore();
  return _instance;
}

export function resetDomainStore(): void {
  _instance = null;
}

export interface WorkingTimeResult {
  lateMinutes: number;
  isLate: boolean;
}

export interface CheckoutTimeResult {
  earlyCheckoutMinutes: number;
  isEarlyCheckout: boolean;
  totalWorkingMinutes: number;
}

const timeToMinutes = (time: string): number => {
  const parts = time.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  if (
    hours === undefined ||
    minutes === undefined ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    throw new Error(`Invalid time format: "${time}". Expected "HH:mm".`);
  }

  return hours * 60 + minutes;
};

const getTimeInTimezone = (date: Date, timezone: string): string => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export const calculateLateMinutes = ({
  checkInTime,
  officeStartTime,
  gracePeriodMinutes,
  timezone,
}: {
  checkInTime: Date;
  officeStartTime: string;
  gracePeriodMinutes: number;
  timezone: string;
}): WorkingTimeResult => {
  const actualTime = getTimeInTimezone(checkInTime, timezone);

  const actualMinutes = timeToMinutes(actualTime);

  const allowedMinutes = timeToMinutes(officeStartTime) + gracePeriodMinutes;

  const lateMinutes = Math.max(0, actualMinutes - allowedMinutes);

  return {
    lateMinutes,
    isLate: lateMinutes > 0,
  };
};

export const calculateCheckoutDetails = ({
  checkInAt,
  checkOutAt,
  officeEndTime,
  timezone,
}: {
  checkInAt: Date;
  checkOutAt: Date;
  officeEndTime: string;
  timezone: string;
}): CheckoutTimeResult => {
  const checkInMinutes = timeToMinutes(getTimeInTimezone(checkInAt, timezone));

  const checkOutMinutes = timeToMinutes(
    getTimeInTimezone(checkOutAt, timezone),
  );

  const expectedEndMinutes = timeToMinutes(officeEndTime);

  const totalWorkingMinutes = Math.max(0, checkOutMinutes - checkInMinutes);

  const earlyCheckoutMinutes = Math.max(
    0,
    expectedEndMinutes - checkOutMinutes,
  );

  return {
    totalWorkingMinutes,
    earlyCheckoutMinutes,
    isEarlyCheckout: earlyCheckoutMinutes > 0,
  };
};

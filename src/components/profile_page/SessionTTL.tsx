// src/components/SessionTTL.jsx
"use client";

import React from "react";
import { useTranslations } from "next-intl"; // already present (keine Änderung am Import nötig)

const SessionTTL = ({ ttlInSeconds }: { ttlInSeconds: number }) => {
  const t = useTranslations("Common"); // bestehend / bestätigt

  if (ttlInSeconds === undefined || ttlInSeconds < 0) {
    return null;
  }

  const days = Math.floor(ttlInSeconds / (60 * 60 * 24));
  const hours = Math.floor((ttlInSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((ttlInSeconds % (60 * 60)) / 60);
  const seconds = ttlInSeconds % 60;

  return (
    <p>
      {days > 0 && `${days} ${t("time.daysUnit")} `}
      {hours > 0 && `${hours} ${t("time.hoursUnit")} `}
      {minutes > 0 && `${minutes} ${t("time.minutesUnit")} `}
      {`${seconds} ${t("time.secondsUnit")}`}
    </p>
  );
};

export default SessionTTL;

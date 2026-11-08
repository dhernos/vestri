export const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);

const countryCodes = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && countryCodes.has(value);
}

export function countryName(code: string | undefined, locale: string): string {
  return isCountryCode(code)
    ? new Intl.DisplayNames([locale], { type: "region" }).of(code) || code
    : "";
}

export function countryMatches(
  code: string | undefined,
  query: string,
  locale: string,
): boolean {
  return (
    isCountryCode(code) &&
    `${code} ${countryName(code, locale)}`
      .toLocaleLowerCase(locale)
      .includes(query.trim().toLocaleLowerCase(locale))
  );
}

export type CountryPolicy = {
  countryWhitelistEnabled?: boolean;
  countryWhitelist?: string[];
  countryBans?: string[];
};

export function countryPolicyState(policy?: CountryPolicy) {
  return {
    supported:
      typeof policy?.countryWhitelistEnabled === "boolean" &&
      Array.isArray(policy.countryWhitelist) &&
      Array.isArray(policy.countryBans),
    enabled: policy?.countryWhitelistEnabled === true,
    allowed: [...new Set(policy?.countryWhitelist ?? [])].filter(isCountryCode),
    banned: [...new Set(policy?.countryBans ?? [])].filter(isCountryCode),
  };
}

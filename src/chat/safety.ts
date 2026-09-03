/**
 * モデルに渡す前の安全チェック。
 * 緊急性の高い訴えは、生成を待たせずに定型文で即答して受診を促す。
 */
import { siteConfig } from "../config.js";

const { clinic, character, policy } = siteConfig;

/** 救急受診を優先すべき訴え */
const EMERGENCY = [
  /(意識|気を失|失神|倒れ)/,
  /(呼吸|息)が?(苦し|できな|しづら)/,
  /(激しい|強い|我慢できない|耐えられない)(腹痛|痛み|吐き気|嘔吐)/,
  /(血を吐|吐血|血便|真っ黒な便|下血)/,
  /(胸が?痛|胸の痛み|締め付けられる)/,
  /(アナフィラキシー|顔が腫れ|全身にじんま|喉が腫れ)/,
  /(何日も|ずっと)(吐い|嘔吐|下痢)/,
  /(過剰|多く|2倍|二回|２回)(打っ|注射し|投与し)(て|た)/,
  /(低血糖|冷や汗|震えが止まらない)/,
];

/** こころの危機に関する訴え */
const CRISIS = [
  /(死にたい|消えたい|自殺|生きていたくない|リストカット)/,
  /(食べたものを吐|過食して吐|拒食)/,
];

export type SafetyVerdict =
  | { kind: "ok" }
  | { kind: "emergency"; reply: string }
  | { kind: "crisis"; reply: string };

export function checkUserMessage(message: string): SafetyVerdict {
  const text = message.replace(/\s+/g, "");

  if (EMERGENCY.some((re) => re.test(text))) {
    return {
      kind: "emergency",
      reply: [
        "おつらい状況ですね。まず先にお伝えします。",
        policy.urgentNotice,
        clinic.tel
          ? `診療時間内（${clinic.hours}）であれば ${clinic.tel} へお電話ください。`
          : "",
        `${character.name}は一般的なご案内しかできないため、この内容は必ず医師の判断を受けてください。`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (CRISIS.some((re) => re.test(text))) {
    return {
      kind: "crisis",
      reply: [
        "つらいお気持ちを書いてくださって、ありがとうございます。",
        `その内容は${character.name}ではお答えしきれないので、専門の窓口にもご相談ください。`,
        "・こころの健康相談統一ダイヤル：0570-064-556",
        "・いのちの電話：0570-783-556",
        "命に関わる危険があるときは、ためらわず119へご連絡ください。",
        clinic.contactUrl
          ? `${clinic.shortName}へのご相談はこちらからも受け付けています：${clinic.contactUrl}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return { kind: "ok" };
}

const MAX_MESSAGE_LENGTH = 1000;

/** 制御文字を落として長さを制限する */
export function sanitizeUserMessage(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

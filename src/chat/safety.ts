/**
 * モデルに渡す前の安全チェック。
 * 緊急性の高い訴えは、生成を待たせずに定型文で即答して受診を促す。
 */
import { siteConfig } from "../config.js";

const { clinic, character, policy } = siteConfig;

/** アナフィラキシー等、ただちに救急対応が必要な訴え */
const EMERGENCY = [
  // 「アナフィラキシーとは？」のような説明を求める質問は緊急扱いにしない
  /アナフィラキシー(ショック|.{0,6}(起き|出た|なっ|かも|疑|し(て|た)))/,
  /(エピペン|アドレナリン自己注射).{0,10}(打っ|使っ|使用し|射っ|必要|どうす)/,
  /(呼吸|息)が?(苦し|できな|しづら|荒)/,
  /(ゼーゼー|ヒューヒュー|喘鳴|ぜんそくの発作|喘息発作)/,
  /(喉|のど|口|唇|舌|顔)が?(腫れ|むくん|ふくらん)/,
  /(声がかすれ|声が出な|飲み込みにく|むせ)/,
  /(全身|急に|一気に|みるみる).{0,8}(じんましん|蕁麻疹|発疹|腫れ)/,
  /(じんましん|蕁麻疹).{0,8}(全身|広がっ|止まらな|ひどく)/,
  /(意識|気を失|失神|倒れ|ぐったり|反応がな)/,
  /(顔色が(悪|青)|唇が(紫|青)|冷や汗)/,
  /(蜂に刺され|ハチに刺され)/,
  /(食べ(た|て)(直後|すぐ)).{0,12}(腫れ|苦し|吐い|じんましん)/,
  /(血圧が下がっ|めまいがして立てな)/,
];

/** こころの危機に関する訴え */
const CRISIS = [/(死にたい|消えたい|自殺|生きていたくない|リストカット)/];

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
        "エピペン（アドレナリン自己注射）をお持ちで、医師から使用の指示を受けている場合は、その指示に従ってください。",
        clinic.tel
          ? `診療時間内（${clinic.hours}）であれば ${clinic.tel} へお電話ください。`
          : "",
        `${character.name}は一般的なご案内しかできません。この内容は必ず医師の判断を受けてください。`,
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

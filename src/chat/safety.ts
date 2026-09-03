/**
 * モデルに渡す前の安全チェック。
 * 緊急性の高い訴えは、生成を待たせずに定型文で即答して受診を促す。
 */
import { siteConfig } from "../config.js";

const { clinic, character, policy } = siteConfig;

/**
 * ただちに受診・救急につなぐべき訴え（診療科を問わない危険サイン）。
 * 医院の診療内容に合わせて、ここに項目を足し引きしてください。
 */
const EMERGENCY = [
  // 呼吸・循環
  /(呼吸|息)が?(苦し|できな|しづら|荒)/,
  /(ゼーゼー|ヒューヒュー|喘鳴|発作で.{0,4}苦し)/,
  /(胸が?痛|胸の痛み|締め付けられる|動悸が止まらな)/,
  // 意識・神経
  /(意識|気を失|失神|倒れ|ぐったり|反応がな|けいれん|痙攣)/,
  /(ろれつ|しゃべりにく|手足がしびれて動かな|半身が動かな)/,
  // 出血・強い痛み
  /(大量に出血|血が止まらな|吐血|血を吐|下血|血便)/,
  /(激しい|強い|我慢できない|耐えられない).{0,6}(痛|頭痛|腹痛)/,
  // アレルギー・アナフィラキシー
  /アナフィラキシー(ショック|.{0,6}(起き|出た|なっ|かも|疑|し(て|た)))/,
  /(エピペン|アドレナリン自己注射).{0,10}(打っ|使っ|使用し|射っ|必要|どうす)/,
  /(喉|のど|口|唇|舌|顔)が?(腫れ|むくん|ふくらん)/,
  /(全身|急に|一気に|みるみる).{0,8}(じんましん|蕁麻疹|発疹|腫れ)/,
  /(じんましん|蕁麻疹).{0,8}(全身|広がっ|止まらな|ひどく)/,
  /(蜂に刺され|ハチに刺され)/,
  // 全身状態
  /(高熱|40度|４０度).{0,8}(ぐったり|下がらな|続いて)/,
  /(顔色が(悪|青)|唇が(紫|青)|冷や汗)/,
  /(薬|くすり).{0,6}(飲み過ぎ|多く飲ん|誤飲|誤って飲)/,
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
        "医師から緊急時の対応（お薬の使用など）を指示されている場合は、その指示に従ってください。",
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

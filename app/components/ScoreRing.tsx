import { scoreBand, type ScoreBand } from "../seo/score";

// Polaris admin palette values, so the ring matches the badges around it.
const BAND_COLOR: Record<ScoreBand, string> = {
  good: "#29845a",
  fair: "#b98900",
  poor: "#e22c38",
};

const BAND_LABEL: Record<ScoreBand, string> = {
  good: "Good",
  fair: "Needs work",
  poor: "Poor",
};

export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const band = scoreBand(score);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`SEO score ${score} out of 100, ${BAND_LABEL[band]}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e3e3e3"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={BAND_COLOR[band]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.3}
        fontWeight={650}
        fill="#303030"
      >
        {score}
      </text>
      <text
        x="50%"
        y="68%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.1}
        fill="#616161"
      >
        {BAND_LABEL[band]}
      </text>
    </svg>
  );
}

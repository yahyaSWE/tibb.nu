import Link from "next/link";
import { ArrowUpRight, BookOpen, Leaf, Play, Sprout } from "lucide-react";

type CourseCardProps = {
  course: {
    id: number;
    title: string;
    slug: string;
    description: string;
    priceOre: number;
  };
  index?: number;
  href?: string;
  progress?: number;
};

export function formatPrice(priceOre: number) {
  return priceOre > 0
    ? new Intl.NumberFormat("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }).format(priceOre / 100)
    : "Kontakta oss för information";
}

export function CourseCard({
  course,
  index = 0,
  href,
  progress,
}: CourseCardProps) {
  const illustrations = [Leaf, Sprout, BookOpen];
  const Illustration = illustrations[index % illustrations.length];
  return (
    <Link href={href || `/kurser/${course.slug}`} className="course-card">
      <div className={`course-art course-art-${index % 3}`}>
        <span className="course-art-ring" />
        <Illustration size={84} strokeWidth={1} aria-hidden="true" />
        <span className="course-art-label">TIBB AKADEMI</span>
        <span className="course-art-badge">
          <Play size={12} fill="currentColor" /> Onlinekurs
        </span>
      </div>
      <div className="course-card-body">
        <p className="eyebrow">Kunskap för livet</p>
        <h3>{course.title}</h3>
        <p className="muted clamp-three">{course.description}</p>
        {progress !== undefined ? (
          <div className="course-progress">
            <div className="progress-track">
              <span
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className="course-card-footer">
              <span>{progress}% genomförd</span>
              <ArrowUpRight size={19} />
            </div>
          </div>
        ) : (
          <div className="course-card-footer">
            <span>{formatPrice(course.priceOre)}</span>
            <ArrowUpRight size={19} />
          </div>
        )}
      </div>
    </Link>
  );
}

type ArticleCardProps = {
  article: { title: string; slug: string; excerpt: string; createdAt: string };
  index?: number;
};

export function ArticleCard({ article, index = 0 }: ArticleCardProps) {
  const styles = ["article-art-olive", "article-art-sand", "article-art-sage"];
  const icons = [Sprout, Leaf, BookOpen];
  const Illustration = icons[index % icons.length];
  return (
    <Link href={`/artiklar/${article.slug}`} className="article-card">
      <div className={`article-art ${styles[index % styles.length]}`}>
        <Illustration size={64} strokeWidth={1} aria-hidden="true" />
        <span>TIBB JOURNAL</span>
      </div>
      <div className="article-card-body">
        <p className="eyebrow">
          {new Date(article.createdAt).toLocaleDateString("sv-SE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h3>{article.title}</h3>
        <p className="muted clamp-three">{article.excerpt}</p>
        <span className="text-link">
          Läs artikeln <ArrowUpRight size={17} />
        </span>
      </div>
    </Link>
  );
}

export function TextContent({ text }: { text: string }) {
  return (
    <div className="prose">
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} style={{ whiteSpace: "pre-line" }}>
            {paragraph}
          </p>
        ))}
    </div>
  );
}

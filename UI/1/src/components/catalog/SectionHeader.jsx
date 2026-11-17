import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
export default function SectionHeader({
  title,
  count,
  countUnit = "عنوان",
  to,
  eyebrow,
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
        <h2>
          {title}
          {Number.isFinite(count) && (
            <span className="section-count">
              {count.toLocaleString("fa-IR")} {countUnit}
            </span>
          )}
        </h2>
      </div>
      {to && (
        <Link to={to}>
          مشاهده همه <Icon name="left" size={16} />
        </Link>
      )}
    </header>
  );
}

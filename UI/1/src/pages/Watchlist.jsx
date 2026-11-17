import MovieCard from "../components/catalog/MovieCard.jsx";
import { MediaGrid } from "../components/catalog/MediaGrid.jsx";
import SectionHeader from "../components/catalog/SectionHeader.jsx";
import { EmptyState } from "../components/ui/Feedback.jsx";
import useWatchlist from "../hooks/useWatchlist.js";
import useDocumentTitle from "../hooks/useDocumentTitle.js";
export default function Watchlist() {
  const { items } = useWatchlist();
  useDocumentTitle("فهرست من");
  return (
    <div className="catalog-container watchlist-page">
      <SectionHeader title="فهرست من" count={items.length} />
      <p className="page-intro">
        انتخاب‌های شما برای تماشای بعدی؛ ذخیره‌شده در همین مرورگر.
      </p>
      {items.length ? (
        <MediaGrid>
          {items.map((m) => (
            <MovieCard key={m._id ?? m.id} movie={m} />
          ))}
        </MediaGrid>
      ) : (
        <EmptyState
          title="جای داستان بعدی شما اینجاست"
          hint="با زدن علامت + روی هر عنوان، آن را به فهرست خود اضافه کنید."
          actionLabel="کشف فیلم‌ها"
          actionTo="/search"
        />
      )}
    </div>
  );
}

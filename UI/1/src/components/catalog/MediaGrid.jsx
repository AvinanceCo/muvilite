import { useRef, useState, useEffect } from "react";
import Icon from "../ui/Icon.jsx";
export function MediaGrid({ children }) {
  return <div className="media-grid">{children}</div>;
}
export function MediaRail({ children }) {
  const rail = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  function update() {
    const e = rail.current;
    setEdges({
      start: Math.abs(e.scrollLeft) < 3,
      end: Math.abs(e.scrollLeft) + e.clientWidth >= e.scrollWidth - 3,
    });
  }
  useEffect(() => {
    const observer = new ResizeObserver(update);
    observer.observe(rail.current);
    update();
    return () => observer.disconnect();
  }, [children]);
  function move(dir) {
    rail.current?.scrollBy({
      left: dir * rail.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  }
  return (
    <div className="rail-wrap">
      <ul ref={rail} onScroll={update} className="media-rail no-scrollbar">
        {children}
      </ul>
      <button
        className="rail-arrow rail-prev"
        aria-label="عنوان‌های قبلی"
        disabled={edges.start}
        onClick={() => move(1)}
      >
        <Icon name="right" />
      </button>
      <button
        className="rail-arrow rail-next"
        aria-label="عنوان‌های بعدی"
        disabled={edges.end}
        onClick={() => move(-1)}
      >
        <Icon name="left" />
      </button>
    </div>
  );
}
export function RailItem({ children, wide = false }) {
  return <li className={`rail-item ${wide ? "rail-wide" : ""}`}>{children}</li>;
}
export default { MediaGrid, MediaRail, RailItem };

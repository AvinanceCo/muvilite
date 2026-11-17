import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import logo from "../assets/images/muvilite-logo.png";
import mark from "../assets/images/muvilite-mark.png";
import { PRODUCT_NAME, useBranding } from "../context/BrandingContext.jsx";
import { mediaUrl } from "../services/media.js";
import { fetchPage } from "../api/catalog.js";
import Icon from "../components/ui/Icon.jsx";
import useWatchlist from "../hooks/useWatchlist.js";
const DEMO = import.meta.env.VITE_DEMO_MODE === "true";
export default function MainLayout() {
  const [menu, setMenu] = useState(false),
    [categories, setCategories] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { siteName, footerLogoPath } = useBranding();
  const { items } = useWatchlist();
  const { data } = useQuery({
    queryKey: ["page", "film"],
    queryFn: () => fetchPage("film"),
  });
  const cats = [
    ...new Map(
      (data?.blocks || [])
        .filter((b) => b.type === "category")
        .map((b) => [b.category.id, b.category]),
    ).values(),
  ];
  useEffect(() => {
    setMenu(false);
    setCategories(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => {
    if (!menu && !categories) return;
    const fn = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        setCategories(false);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [menu, categories]);
  const home = location.pathname === "/";
  return (
    <div className="cinema-shell">
      <a href="#main-content" className="skip-link">
        رفتن به محتوا
      </a>
      <header
        className={`cinema-header ${scrolled || !home ? "is-solid" : ""}`}
      >
        <div className="nav-inner">
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
          <Link to="/" aria-label={siteName} className="brand-logo">
            {siteName === PRODUCT_NAME ? (
              <img src={logo} alt="Muvi Lite" />
            ) : (
              <>
                <img src={mark} alt="" />
                <strong>{siteName}</strong>
              </>
            )}
          </Link>
          <nav
            className={`desktop-nav ${menu ? "mobile-open" : ""}`}
            aria-label="منوی اصلی"
          >
            <NavLink to="/" end>
              خانه
            </NavLink>
            <NavLink to="/page/film">فیلم و سریال</NavLink>
            <div className="category-nav">
              <button
                aria-expanded={categories}
                onClick={() => setCategories(!categories)}
              >
                دسته‌بندی‌ها <Icon name="down" size={14} />
              </button>
              {categories && (
                <>
                  <button
                    className="dropdown-backdrop"
                    tabIndex={-1}
                    aria-label="بستن دسته‌بندی‌ها"
                    onClick={() => setCategories(false)}
                  />
                  <div className="category-menu">
                    {cats.length ? (
                      cats.map((c) => (
                        <Link key={c.id} to={`/category/${c.id}`}>
                          {c.nameFa}
                          <Icon name="left" size={14} />
                        </Link>
                      ))
                    ) : (
                      <Link to="/search">همه عنوان‌ها</Link>
                    )}
                  </div>
                </>
              )}
            </div>
            <NavLink to="/page/music">موسیقی</NavLink>
            <NavLink to="/page/clips">کلیپ</NavLink>
            <NavLink to="/games" className="mobile-only">
              بازی‌ها
            </NavLink>
            <NavLink to="/poll" className="mobile-only">
              نظرسنجی
            </NavLink>
          </nav>
          <div className="nav-actions">
            <Link to="/search" aria-label="جستجو" className="icon-button">
              <Icon name="search" size={23} />
            </Link>
            <span className="nav-divider" />
            <Link to="/watchlist" className="watchlist-nav">
              <Icon name="bookmark" size={18} />
              <span>فهرست من</span>
              {items.length > 0 && (
                <b>{items.length.toLocaleString("fa-IR")}</b>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content" className={home ? "home-main" : "inner-main"}>
        <Outlet />
      </main>
      <footer className="cinema-footer">
        <div className="footer-top">
          <Link to="/" className="brand-logo">
            <img src={logo} alt="Muvi Lite" />
          </Link>
          <span>هر سلیقه‌ای، یک دنیای تماشایی.</span>
          <div>
            <Link to="/search">کشف فیلم‌ها</Link>
            <Link to="/page/music">موسیقی</Link>
            <Link to="/games">بازی‌ها</Link>
            <Link to="/poll">نظرسنجی</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            {DEMO
              ? "نسخه نمایشی رابط کاربری • تصاویر و عنوان‌ها برای نمایش طراحی هستند."
              : "قدرت‌گرفته از Muvi Lite، محصول آوین‌انس"}
          </span>
          {footerLogoPath && (
            <img src={mediaUrl(footerLogoPath)} alt={siteName} />
          )}
          <span dir="ltr">
            MUVI LITE <span className="footer-dot">•</span> BY AVINANCE
          </span>
        </div>
      </footer>
    </div>
  );
}

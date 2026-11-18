"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, ChevronDown, Clock3, Heart, MapPin, Search, ShieldCheck, Sparkles, Star, Wrench, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import DetectCityButton from "@/components/DetectCityButton";
import { ApiError, api, formatPrice } from "@/lib/api";
import type { Role, ServiceCategory, Worker } from "@/lib/types";

const categoryStyles: Record<string, { icon: typeof Wrench; tint: string }> = {
  plumber: { icon: Wrench, tint: "mint" },
  electrician: { icon: Zap, tint: "butter" },
  cleaning: { icon: Sparkles, tint: "lilac" },
  "ac repair": { icon: Clock3, tint: "sky" },
  carpenter: { icon: Wrench, tint: "peach" },
  salon: { icon: Heart, tint: "rose" },
};

const cities = ["All cities", "Delhi", "Mumbai", "Bengaluru"];

function WorkerCard({ worker, index, onBook }: { worker: Worker; index: number; onBook: (worker: Worker) => void }) {
  return (
    <article className={`pro-card pro-card-${index % 4}`}>
      <div className="pro-portrait">
        <div className="portrait-orbit" />
        <div className="portrait-person"><span>{worker.name.slice(0, 1).toUpperCase()}</span></div>
        <span className="verified-chip"><BadgeCheck size={13} /> Verified</span>
        <button className="favorite-button" aria-label={`Save ${worker.name}`}><Heart size={16} /></button>
      </div>
      <div className="pro-body">
        <div className="pro-name-row"><h3>{worker.name}</h3><span className="pro-rating"><Star size={13} fill="currentColor" /> {Number(worker.rating).toFixed(1)} <small>({worker.reviewCount || 0})</small></span></div>
        <p className="pro-title">{worker.profession}</p>
        <div className="pro-meta"><span><MapPin size={13} /> {worker.city}</span><span><Clock3 size={13} /> {worker.experience}+ yrs</span></div>
        <div className="pro-footer"><p><strong>₹{formatPrice(worker.price)}</strong><small> / hour</small></p><button className="book-button" onClick={() => onBook(worker)}>Book pro <ArrowRight size={15} /></button></div>
      </div>
    </article>
  );
}

export default function Marketplace() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookingAuthError, setBookingAuthError] = useState("");
  const [bookingLoginUrl, setBookingLoginUrl] = useState("");

  useEffect(() => {
    api<{ categories: ServiceCategory[] }>("workers/categories")
      .then(({ categories: availableCategories }) => setCategories(availableCategories))
      .catch((reason: Error) => setCategoryError(reason.message));
  }, []);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    if (city) query.set("city", city);
    if (search.trim()) query.set("search", search.trim());
    try {
      const result = await api<{ workers: Worker[] }>(`workers?${query}`);
      setWorkers(result.workers || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load professionals.");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [category, city, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWorkers(), search ? 220 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadWorkers, search]);

  async function bookWorker(worker: Worker) {
    setBookingAuthError("");
    const bookingPath = `/customer?${new URLSearchParams({ book: worker._id })}`;
    setBookingLoginUrl("");
    try {
      const { user } = await api<{ user: { role: Role } }>("auth/me");
      if (user.role !== "customer") {
        setBookingAuthError(`You’re signed in as a ${user.role === "worker" ? "service provider" : "administrator"}. Sign in with a customer account to book a service.`);
        setBookingLoginUrl(`/login?next=${encodeURIComponent(bookingPath)}`);
        return;
      }
      router.push(bookingPath);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.push(`/login?next=${encodeURIComponent(bookingPath)}`);
        return;
      }
      setBookingAuthError(reason instanceof Error ? reason.message : "Could not check your sign-in. Please try again.");
    }
  }

  function chooseCategory(nextCategory: string) {
    setCategory(category === nextCategory ? "" : nextCategory);
    window.requestAnimationFrame(() => {
      document.querySelector("#professionals")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function chooseCity(nextCity: string) {
    setCity(nextCity);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> GOOD HELP, RIGHT AROUND THE CORNER</p>
            <h1>Home stuff.<br /><span>Handled.</span></h1>
            <p className="hero-description">The little things that make a house a home, taken care of by people who care.</p>
            <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void loadWorkers(); }}>
              <label className="search-query"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What can we help with?" aria-label="Search services" /></label>
              <span className="search-separator" />
              <label className="city-query"><MapPin size={18} /><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Choose a city"><option value="">All cities</option>{city && !cities.includes(city) && <option value={city}>{city}</option>}{cities.slice(1).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
              <button type="submit" className="search-submit">Find help <ArrowRight size={16} /></button>
            </form>
            <div className="hero-location"><DetectCityButton onCity={chooseCity} /><span>With your permission, your coordinates are used to look up your city via OpenStreetMap. Only the city is used for matching.</span></div>
            <div className="hero-social-proof"><div className="avatar-stack"><span>R</span><span>A</span><span>M</span><span>+</span></div><p><strong>Good people, great work.</strong><br />Trusted in neighbourhoods like yours.</p><div className="proof-stars"><Star size={13} fill="currentColor" /> 4.9</div></div>
          </div>
          <div className="hero-visual">
            <div className="hero-sun" />
            <div className="hero-photo">
              <div className="hero-worker-head"><span className="hero-worker-hair" /><span className="hero-worker-face"><i /><i /><b /></span></div>
              <div className="hero-worker-body"><span className="worker-pocket" /></div>
              <div className="hero-toolbox"><Wrench size={24} /></div>
            </div>
            <div className="float-card float-verified"><span className="float-icon"><ShieldCheck size={19} /></span><span><strong>Good hands.</strong><small>Every pro, verified</small></span><Check className="float-check" size={17} /></div>
            <div className="float-card float-booking"><span className="booking-icon"><CalendarDays size={18} /></span><span><strong>You&apos;re all set!</strong><small>One less thing to worry about</small></span></div>
            <span className="visual-caption">YOUR NEIGHBOURHOOD, SORTED <Sparkles size={14} /></span>
            <span className="visual-sticker">made for<br />real life</span>
          </div>
          <a className="hero-scroll" href="#services"><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
        </section>

        <section id="services" className="section services-section">
          <div className="section-heading">
            <div><p className="eyebrow">A LITTLE HELP GOES A LONG WAY</p><h2>What needs <span>doing?</span></h2></div>
            <p>Pick a service. We’ll find the right person.</p>
          </div>
          <div className="category-grid">
            {categories.map(({ name, label }) => {
              const style = categoryStyles[name.toLowerCase()] || { icon: Wrench, tint: "mint" };
              const Icon = style.icon;
              return <button key={name} onClick={() => chooseCategory(name)} className={`category-card ${category === name ? "category-active" : ""}`}>
                <span className={`category-icon ${style.tint}`}><Icon size={22} strokeWidth={1.7} /></span><span>{label}</span><ArrowUpRight className="category-arrow" size={15} />
              </button>
            })}
          </div>
          {categoryError && <p className="inline-error" role="alert">Service categories load nahi ho payi: {categoryError}</p>}
        </section>

        <section id="professionals" className="section pros-section">
          <div className="section-heading">
            <div><p className="eyebrow">GOOD HANDS, CLOSE BY</p><h2>Meet your <span>local pros.</span></h2></div>
            <Link href="/login?mode=register&role=worker" className="text-link">Work with us <ArrowUpRight size={16} /></Link>
          </div>
          {bookingAuthError && <p className="inline-error" role="alert">{bookingAuthError} {bookingLoginUrl && <Link href={bookingLoginUrl}>Sign in as a customer</Link>}</p>}
          {(category || city || search) && <div className="filter-line"><span>Showing: {category || "All services"}{city ? ` · ${city}` : ""}{search ? ` · “${search}”` : ""}</span><button onClick={() => { setCategory(""); setCity(""); setSearch(""); }}>Clear filters <XIcon /></button></div>}
          {error ? <div className="empty-message error-message"><strong>Couldn’t load the pros.</strong><span>{error}</span><button className="outline-button" onClick={() => void loadWorkers()}>Try again</button></div> : loading ? <div className="empty-message"><span className="loading-dot" /> Finding good people near you…</div> : workers.length ? <div className="pro-grid">{workers.slice(0, 8).map((worker, index) => <WorkerCard key={worker._id} worker={worker} index={index} onBook={bookWorker} />)}</div> : <div className="empty-message"><strong>No professionals found just yet.</strong><span>Try a different service or city.</span><button className="outline-button" onClick={() => { setCategory(""); setCity(""); setSearch(""); }}>Show everyone</button></div>}
          <div className="trust-ribbon"><span className="trust-ribbon-icon"><ShieldCheck size={22} /></span><div><strong>Good work deserves trust.</strong><span>We verify the professionals who show up at your door.</span></div><span className="trust-ribbon-note"><BadgeCheck size={15} /> VERIFIED LOCAL PROS</span></div>
        </section>

        <section className="story-section">
          <div className="story-mark"><span>✳</span><span>KH</span></div>
          <div className="story-copy"><p className="eyebrow">A MORE HUMAN WAY TO GET THINGS DONE</p><h2>More time for<br />the <span>good stuff.</span></h2><p>Life&apos;s already full. The last thing you need is another afternoon searching for someone to fix a tap. We bring good people, reliable work, and a little peace of mind right to your door.</p><Link className="story-link" href="/login?mode=register">Find your people <ArrowRight size={16} /></Link></div>
          <div className="story-side"><div className="story-stat"><strong>Good people</strong><span>Real pros from your neighbourhood.</span></div><div className="story-stat"><strong>Good work</strong><span>Thoughtful service, every single time.</span></div><div className="story-stat"><strong>Good feeling</strong><span>One less thing on your mind.</span></div></div>
          <span className="story-spark"><Sparkles size={22} /></span>
        </section>

        <section className="join-section"><div><p className="eyebrow">GOOD AT WHAT YOU DO?</p><h2>Your work deserves<br /><span>to be found.</span></h2><p>Join the neighbourhood pros making everyday life a little easier.</p></div><Link href="/login?mode=register&role=worker">Join as a professional <ArrowRight size={17} /></Link><span className="join-deco">✳</span></section>
      </main>
      <footer className="site-footer"><Link className="brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link><span>For the everyday. Made with care.</span><span>© 2026 KaamGhar</span></footer>
    </>
  );
}

function XIcon() {
  return <span aria-hidden="true">×</span>;
}

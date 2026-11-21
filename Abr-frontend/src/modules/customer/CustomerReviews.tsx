"use client";

import { useEffect, useState, type FormEvent } from "react";
import DashboardFrame from "@/components/DashboardFrame";
import { LoadingLine } from "@/components/DashboardParts";
import { api, formatDate } from "@/lib/api";
import type { Booking } from "@/lib/types";

export type Review = { _id: string; rating: number; text?: string; createdAt: string; worker?: Booking["worker"] };

function ReviewList({ reviews }: { reviews: Review[] }) {
  return <div className="customer-experience-list">
    {!reviews.length && <p>No reviews yet.</p>}
    {reviews.map((review) => <article key={review._id}>
      <strong>{review.worker?.name ? `${review.worker.name} · ` : ""}{review.rating} / 5</strong>
      <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
      {review.text && <p>{review.text}</p>}
    </article>)}
  </div>;
}

export function ProfessionalReviews({ workerId }: { workerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    api<{ reviews: Review[] }>(`workers/${workerId}/reviews`, { signal: controller.signal })
      .then((result) => { setReviews(result.reviews); setError(""); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [expanded, workerId]);

  return <div className="customer-experience">
    <button className="button button-outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? "Hide reviews" : "Read customer reviews"}
    </button>
    {expanded && (error ? <p className="inline-error" role="alert">{error}</p> : reviews ? <ReviewList reviews={reviews} /> : <LoadingLine />)}
  </div>;
}

function CustomerReviews({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (value: string) => void }) {
  const [data, setData] = useState<{ reviews: Review[]; eligible: Booking[] }>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<{ reviews: Review[]; eligible: Booking[] }>("customer-experience/reviews", { signal: controller.signal })
      .then((result) => { setData(result); setError(""); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      await api("customer-experience/reviews", { method: "POST", body: JSON.stringify({
        bookingId: fields.get("bookingId"), rating: Number(fields.get("rating")), text: fields.get("text"),
      }) });
      form.reset();
      notify("Review published.");
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish your review.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="dash-panel customer-experience">
    <div className="panel-heading"><h2>Reviews &amp; Ratings</h2></div>
    <p>You can leave one public review per completed booking. Keep your review about the service and leave out personal details.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!data && !error && <LoadingLine />}
    {data && <>
      {data.eligible.length ? <form className="profile-form customer-experience-form" onSubmit={submit}>
        <label>Completed booking<select name="bookingId" defaultValue="" required>
          <option value="" disabled>Choose a booking</option>
          {data.eligible.map((booking) => <option key={booking._id} value={booking._id}>
            {booking.worker?.name ?? "Professional"} — {formatDate(booking.scheduledAt)}
          </option>)}
        </select></label>
        <label>Rating<select name="rating" defaultValue="" required>
          <option value="" disabled>Choose 1–5 stars</option>
          {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}
        </select></label>
        <label>Review (optional)<textarea name="text" maxLength={1000} rows={4} /></label>
        <button className="button button-dark" disabled={saving}>Publish review</button>
      </form> : <p>No completed bookings are waiting for a review.</p>}
      <h3>Your reviews</h3>
      <ReviewList reviews={data.reviews} />
    </>}
  </section>;
}

export default function CustomerReviewsPage() {
  return <DashboardFrame expectedRole="customer" Screen={CustomerReviews} />;
}

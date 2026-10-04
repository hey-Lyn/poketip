import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CircleAlert, Search, UserRound, UsersRound, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { searchTrainers } from "../services/trainers";
import type { TrainerProfile } from "../services/trainers";
import TrainerCard from "./TrainerCard";
import "./TrainersPage.css";

interface DirectoryResult {
  trainers: TrainerProfile[];
  hasNextPage: boolean;
  error: string;
}

function TrainerDirectory({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const pageParam = params.get("page") ?? "0";
  const page = /^(0|[1-9]\d{0,6})$/u.test(pageParam) ? Number(pageParam) : 0;
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([query, page, retry]);
  const [result, setResult] = useState<{
    key: string | null;
    trainers: TrainerProfile[];
    hasNextPage: boolean;
    error: string;
  }>({ key: null, trainers: [], hasNextPage: false, error: "" });
  const loading = result.key !== requestKey;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      searchTrainers(query, page)
        .then((data) => {
          if (active) setResult({ key: requestKey, ...data, error: "" });
        })
        .catch((error) => {
          if (active) setResult({ key: requestKey, trainers: [], hasNextPage: false, error: error.message });
        });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, page, requestKey]);

  function changeSearch(value: string) {
    setParams(value ? { q: value } : {}, { replace: true });
  }

  function changePage(next: number) {
    setParams({ ...(query ? { q: query } : {}), ...(next ? { page: String(next) } : {}) });
  }

  return (
    <TrainerDirectoryContent
      query={query}
      page={page}
      loading={loading}
      result={result}
      userId={userId}
      onSearch={changeSearch}
      onPage={changePage}
      onRetry={() => setRetry((value) => value + 1)}
    />
  );
}

export function TrainerDirectoryContent({ query, page, loading, result, userId, onSearch, onPage, onRetry }: {
  query: string;
  page: number;
  loading: boolean;
  result: DirectoryResult;
  userId: string;
  onSearch: Dispatch<string>;
  onPage: Dispatch<number>;
  onRetry: () => void;
}) {
  return (
    <main className="content trainersPage">
      <div className="trainersShell">
        <header className="trainersHeader">
          <div>
            <span className="trainersEyebrow">Pokétip community</span>
            <h1>Trainers</h1>
            <p>Find a familiar name. Get to know someone new.</p>
          </div>
          <Link className="trainerAction" to="/profile"><UserRound aria-hidden="true" /> My profile</Link>
        </header>
        <section className="trainerDirectorySurface" aria-label="Trainer directory">
          <div className="trainerDirectoryToolbar">
            <div className="trainerSearch">
              <Search aria-hidden="true" />
              <label className="trainerVisuallyHidden" htmlFor="trainer-search">Search trainers</label>
              <input
                id="trainer-search"
                type="search"
                value={query}
                maxLength={100}
                placeholder="Search by name or @username"
                onChange={(event) => onSearch(event.target.value)}
              />
              {query && (
                <button className="trainerSearchClear" type="button" aria-label="Clear search" onClick={() => onSearch("")}>
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div className="trainerListHeading">
            <h2 className="trainerSectionLabel"><UsersRound aria-hidden="true" /> {query ? "Search results" : "Community trainers"}</h2>
            {!loading && !result.error && <span>{result.trainers.length} on this page</span>}
          </div>
          <div className="trainerDirectoryResults" aria-busy={loading}>
          {loading ? (
            <div className="trainerLoading">
              <span className="trainerVisuallyHidden" role="status">Loading trainers...</span>
              {[0, 1, 2].map((row) => (
                <div className="trainerSkeleton" key={row} aria-hidden="true">
                  <span /><div><span /><span /></div>
                </div>
              ))}
            </div>
          ) : result.error ? (
            <div className="trainerPanel">
              <div className="trainerStateIcon"><CircleAlert aria-hidden="true" /></div>
              <p role="alert">{result.error}</p>
              <button className="trainerAction" onClick={onRetry}>Try again</button>
            </div>
          ) : result.trainers.length ? (
            <ul className="trainerList">
              {result.trainers.map((trainer) => (
                <li key={trainer.id}>
                  <TrainerCard profile={trainer} isSelf={trainer.id === userId} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="trainerPanel" role="status">
              <div className="trainerStateIcon">{query ? <Search aria-hidden="true" /> : <UsersRound aria-hidden="true" />}</div>
              <h2>{query ? "No trainers found" : page ? "No trainers on this page" : "The community starts with you"}</h2>
              <p>{page ? "Go back to the previous page or try another search." : query ? "Try another name or username." : "Enable your trainer profile to appear here."}</p>
              {query ? <button className="trainerAction" onClick={() => onSearch("")}>Clear search</button> : !page && <Link className="trainerAction" to="/profile">Set up my profile</Link>}
            </div>
          )}
          </div>
        <nav className="trainerPagination" aria-label="Trainer pages">
          <span>Page {page + 1}</span>
          <div className="trainerPageActions">
          <button className="trainerAction" disabled={loading || page === 0} onClick={() => onPage(page - 1)}>
            <ChevronLeft aria-hidden="true" /> Previous
          </button>
          <button className="trainerAction" disabled={loading || !result.hasNextPage} onClick={() => onPage(page + 1)}>
            Next <ChevronRight aria-hidden="true" />
          </button>
          </div>
        </nav>
        </section>
      </div>
    </main>
  );
}

export default function TrainersPage() {
  const { user, loading } = useAuth();
  if (loading) return <main className="content trainersPage"><p role="status">Loading account...</p></main>;
  if (!user) {
    return (
      <main className="content trainersPage">
        <div className="trainerPanel trainersShell">
          <div className="trainerStateIcon"><UsersRound aria-hidden="true" /></div>
          <h1>Trainers</h1>
          <p>Sign in to explore trainer profiles.</p>
          <Link className="trainerAction" to="/profile">Sign in</Link>
        </div>
      </main>
    );
  }
  return <TrainerDirectory key={user.id} userId={user.id} />;
}

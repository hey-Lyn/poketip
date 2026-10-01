import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Pencil,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { extractDominantColors } from "../services/dominantColors";
import { searchPokemon } from "../services/pokeApi";
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH } from "../services/profile";
import AuthPage from "./AuthPage";
import "./ProfilePage.css";

function favoriteSprite(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function toHandle(email) {
  const local = (email ?? "").split("@")[0] ?? "";
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, ".")
    .replace(/^[._-]+|[._-]+$/gu, "");

  return slug || "trainer";
}

function formatMemberSince(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function ProfileEditor({ user, profile, error, save, changeAvatar }) {
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.display_name ?? "");
  const [favorite, setFavorite] = useState(
    profile?.favorite_pokemon_id
      ? { id: profile.favorite_pokemon_id, name: profile.favorite_pokemon_name }
      : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [favoriteResults, setFavoriteResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannerColors, setBannerColors] = useState(null);
  const fileInputRef = useRef(null);
  const bioRef = useRef(null);
  const avatarUrl = profile?.avatar_url;

  useEffect(() => {
    const element = bioRef.current;
    if (!element) return undefined;

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
    return undefined;
  }, [bio]);

  useEffect(() => {
    const query = favoriteQuery.trim().toLowerCase();
    if (query.length < 2) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const data = await searchPokemon(query, 6, controller.signal);
        setFavoriteResults(data.pokemon);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setFavoriteResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [favoriteQuery]);

  useEffect(() => {
    let active = true;
    extractDominantColors(avatarUrl).then((colors) => {
      if (active && colors) setBannerColors(colors);
    });
    return () => {
      active = false;
    };
  }, [avatarUrl]);

  function changeFavoriteQuery(value) {
    setFavoriteQuery(value);
    if (value.trim().length < 2) {
      setFavoriteResults([]);
      setSearching(false);
    }
  }

  async function selectFavorite(pokemon) {
    const next = { id: pokemon.id, name: pokemon.name };
    setFavorite(next);
    setFavoriteQuery("");
    setFavoriteResults([]);
    setPickerOpen(false);
    setStatus("");

    try {
      await save({
        favorite_pokemon_id: next.id,
        favorite_pokemon_name: next.name,
      });
      setStatus("Favorite Pokémon saved.");
    } catch (requestError) {
      setStatus(requestError.message);
    }
  }

  function startEditingName() {
    setNameDraft(profile?.display_name ?? "");
    setEditingName(true);
  }

  async function commitName() {
    setEditingName(false);
    const next = nameDraft.trim();
    if (next === (profile?.display_name ?? "").trim()) return;

    try {
      await save({ display_name: next });
      setStatus("Name updated.");
    } catch (requestError) {
      setStatus(requestError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      await save({
        bio: bio.trim(),
        favorite_pokemon_id: favorite?.id ?? null,
        favorite_pokemon_name: favorite?.name ?? null,
      });
      setStatus("Profile saved.");
    } catch (requestError) {
      setStatus(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setStatus("");
    try {
      await changeAvatar(file);
      setStatus("Avatar updated.");
    } catch (requestError) {
      setStatus(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  const memberSince = formatMemberSince(profile?.created_at);
  const bannerStyle = bannerColors
    ? {
        background:
          `radial-gradient(120% 160% at 100% 120%, rgb(3 22 29 / 62%), transparent 58%), ` +
          `linear-gradient(120deg, ${bannerColors[0]}, ${bannerColors[1]})`,
      }
    : undefined;

  return (
    <main className="content profilePage">
      <section className="profileCard">
        <div className="profileBanner" style={bannerStyle}>
          <div className="profileCredits">
            <strong>{profile?.credits ?? 0}</strong>
            <span>AI credits</span>
          </div>
        </div>

        <header className="profileHeader">
          <div className="profileAvatar">
            <button
              type="button"
              className="profileAvatarButton"
              aria-label="Change profile photo"
              title="Change profile photo"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" />
                : <UserRound aria-hidden="true" />}
              <span className={`profileAvatarOverlay ${uploading ? "isVisible" : ""}`}>
                <Pencil aria-hidden="true" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarChange}
            />
          </div>
          <div className="profileIdentity">
            <h1>
              {editingName ? (
                <input
                  className="profileNameInput"
                  type="text"
                  autoFocus
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={commitName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      setEditingName(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="profileName"
                  title="Click to edit your display name"
                  onClick={startEditingName}
                >
                  {profile?.display_name?.trim() || user.email}
                </button>
              )}
            </h1>
            <p className="profileHandle">
              @{toHandle(user.email)}
              {profile?.role === "admin" && (
                <span className="profileRoleBadge">Admin</span>
              )}
            </p>
            <p className="profileEmail">{user.email}</p>
          </div>
          {memberSince && (
            <p className="profileMeta">
              <Calendar aria-hidden="true" />
              <span>Member since {memberSince}</span>
            </p>
          )}
        </header>

        {error && <p className="authError" role="alert">{error}</p>}

        <form className="profileForm" onSubmit={submit}>
          <div className="profileFavorite">
            <span className="profileSectionTitle">Favorite Pokémon</span>
            {favorite ? (
              <button
                type="button"
                className="profileFavoriteCurrent"
                title="Change favorite Pokémon"
                aria-label={`Change favorite Pokémon (currently ${favorite.name})`}
                onClick={() => setPickerOpen((open) => !open)}
              >
                <img src={favoriteSprite(favorite.id)} alt="" />
                <strong>{favorite.name}</strong>
              </button>
            ) : (
              <button
                type="button"
                className="profileFavoriteAdd"
                aria-label="Choose favorite Pokémon"
                title="Choose favorite Pokémon"
                onClick={() => setPickerOpen((open) => !open)}
              >
                <Plus aria-hidden="true" />
              </button>
            )}
            {pickerOpen && (
              <>
                <div className="profileFavoriteSearch">
                  <Search aria-hidden="true" />
                  <input
                    type="text"
                    autoFocus
                    value={favoriteQuery}
                    placeholder="Search by name or number"
                    onChange={(event) => changeFavoriteQuery(event.target.value)}
                  />
                </div>
                {searching && <p className="profileFavoriteHint">Searching...</p>}
                {!searching && favoriteResults.length > 0 && (
                  <ul className="profileFavoriteResults">
                    {favoriteResults.map((pokemon) => (
                      <li key={pokemon.id}>
                        <button type="button" onClick={() => selectFavorite(pokemon)}>
                          <img src={pokemon.sprite} alt="" />
                          <span>{pokemon.name}</span>
                          <small>#{pokemon.id}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <label className="profileBio">
            <span className="profileSectionTitle">About Me</span>
            <textarea
              ref={bioRef}
              rows={1}
              maxLength={MAX_BIO_LENGTH}
              value={bio}
              placeholder="Tell other trainers about your playstyle..."
              onChange={(event) => setBio(event.target.value)}
            />
            <small>{bio.length}/{MAX_BIO_LENGTH}</small>
          </label>

          {status && <p className="profileStatus" role="status">{status}</p>}

          <button type="submit" className="profileSave" disabled={saving}>
            <Check aria-hidden="true" /> {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading, error, save, changeAvatar } = useProfile(user);

  if (loading) {
    return (
      <main className="content authPage">
        <div className="authPanel">
          <p className="profileStatus">Loading account...</p>
        </div>
      </main>
    );
  }

  if (!user) return <AuthPage />;

  if (profileLoading && !profile) {
    return (
      <main className="content authPage">
        <div className="authPanel">
          <p className="profileStatus">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <ProfileEditor
      key={user.id}
      user={user}
      profile={profile}
      error={error}
      save={save}
      changeAvatar={changeAvatar}
    />
  );
}

export default ProfilePage;

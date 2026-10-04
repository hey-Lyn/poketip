import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH, uploadCover } from "../services/profile";
import { readCropImage } from "../services/imageCrop";
import ProfileImageCropper from "./ProfileImageCropper";
import { getCustomization, trainerCardStyle, trainerCoverStyle } from "../services/trainerCustomization";
import ProfileCustomization from "./ProfileCustomization";
import TrainerCard from "./TrainerCard";
import "./TrainersPage.css";
import { MAX_USERNAME_LENGTH, normalizeUsername } from "../services/trainers";
import AuthPage from "./AuthPage";
import "./ProfilePage.css";

function favoriteSprite(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function formatMemberSince(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function ProfileEditor({ user, profile, error, save, changeAvatar }) {
  const [customization, setCustomization] = useState(() => getCustomization(profile));
  const [coverUploading, setCoverUploading] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [socialEnabled, setSocialEnabled] = useState(profile?.social_enabled ?? false);
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
  const coverInputRef = useRef(null);
  const [imageDraft, setImageDraft] = useState<{ kind: "avatar" | "cover"; source: string }>(null);
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
        ...(profile?.customization_ready === true ? customization : {}),
        ...(profile?.social_ready === false ? {} : {
          username: normalizeUsername(username) || null,
          social_enabled: socialEnabled,
        }),
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

  async function chooseImage(event, kind: "avatar" | "cover") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setStatus("");
    try {
      const source = await readCropImage(file);
      setImageDraft({ kind, source });
    } catch (requestError) {
      setStatus(requestError.message);
    }
  }

  async function applyImage(file: File) {
    if (imageDraft.kind === "avatar") {
      setUploading(true);
      try { await changeAvatar(file); setStatus("Avatar updated."); }
      finally { setUploading(false); }
    } else {
      setCoverUploading(true);
      try {
        const url = await uploadCover(user.id, file);
        setCustomization((previous) => ({ ...previous, cover_url: url, cover_style: "classic" }));
        setStatus("Banner ready. Save your profile to keep it.");
      } finally { setCoverUploading(false); }
    }
  }

  const memberSince = formatMemberSince(profile?.created_at);
  const showPreview = profile?.customization_ready === true;
  const bannerStyle = customization.cover_url || customization.cover_style !== "classic" || profile?.customization_ready !== false
    ? trainerCoverStyle(customization) : bannerColors
    ? {
        background:
          `radial-gradient(120% 160% at 100% 120%, rgb(3 22 29 / 62%), transparent 58%), ` +
          `linear-gradient(120deg, ${bannerColors[0]}, ${bannerColors[1]})`,
      }
    : undefined;

  return (
    <main className="content profilePage">
      <div className={`profileEditorLayout ${showPreview ? "hasPreview" : ""}`}>
      <section className="profileCard" style={trainerCardStyle(customization)}>
        <button type="button" className="profileBanner" style={bannerStyle}
          aria-label="Change profile banner" title={showPreview ? "Change profile banner" : "Banner editing is waiting for database setup"}
          disabled={!showPreview || coverUploading} onClick={() => coverInputRef.current?.click()}>
          <div className="profileCredits">
            <><strong>{profile?.credits ?? 0}</strong><span>AI credits</span></>
          </div>
          <span className="profileBannerOverlay"><Pencil aria-hidden="true" /><span>Change banner</span></span>
        </button>
        <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Banner image file" hidden onChange={(event) => chooseImage(event, "cover")} />

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
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Profile photo file"
              hidden
              onChange={(event) => chooseImage(event, "avatar")}
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
              {profile?.username ? `@${profile.username}` : "Choose your trainer username below"}
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
          {profile?.social_ready === false ? (
            <div className="profileSocial profileSocialUnavailable" role="status">
              <span className="profileSectionTitle">Trainer profile</span>
              <p>Trainer profiles are waiting for their database setup. Your existing profile remains private and can still be edited.</p>
            </div>
          ) : (
          <fieldset className="profileSocial">
            <legend className="profileSectionTitle">Trainer profile</legend>
            <label className="profileUsername">
              Username
              <input
                type="text"
                value={username}
                maxLength={MAX_USERNAME_LENGTH}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="username-help"
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                placeholder="e.g. ash_ketchum"
              />
            </label>
            <p id="username-help">3–24 letters, numbers or underscores. Start with a letter or number.</p>
            <label className="profileSocialToggle">
              <input
                type="checkbox"
                checked={socialEnabled}
                onChange={(event) => setSocialEnabled(event.target.checked)}
                aria-describedby="social-help"
              />
              Show my profile to other trainers
            </label>
            <p id="social-help">
              Signed-in trainers can see your name, username, photo, bio, favorite Pokémon, cover, title, card colors, featured team, favorite game and join date.
              Your email and AI credits stay private.
            </p>
            {profile?.social_enabled && profile?.username && (
              <Link to={`/trainers/${profile.username}`}>View my trainer profile</Link>
            )}
          </fieldset>
          )}
          {profile?.customization_ready !== true ? <p className="profileCustomHint">Profile customization is waiting for its database setup.</p> : (
            <ProfileCustomization value={customization} onChange={setCustomization} colorsEnabled={profile?.card_colors_ready !== false} />
          )}
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

          <button type="submit" className="profileSave" disabled={saving || coverUploading}>
            <Check aria-hidden="true" /> {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
      {showPreview && <section className="profileLivePreview" aria-label="Trainer card preview">
        <h2 className="profileSectionTitle">Live preview</h2>
        <TrainerCard detailed allowChat={false} profile={{
          ...profile, ...customization, id: user.id, display_name: profile?.display_name ?? "", username: username || "your_username", bio,
          favorite_pokemon_id: favorite?.id ?? null, favorite_pokemon_name: favorite?.name ?? null,
        }} />
      </section>}
      </div>
      {imageDraft && <ProfileImageCropper source={imageDraft.source} kind={imageDraft.kind} onApply={applyImage} onClose={() => setImageDraft(null)} />}
    </main>
  );
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading, error, refresh, save, changeAvatar } = useProfile(user);

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

  if (!profile && error) {
    return (
      <main className="content authPage">
        <div className="authPanel">
          <p className="authError" role="alert">{error}</p>
          <button type="button" className="profileSave" onClick={refresh}>Try again</button>
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

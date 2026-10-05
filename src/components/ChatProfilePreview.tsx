import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound, X } from "lucide-react";
import { getTrainerProfile } from "../services/trainers";
import type { TrainerProfile } from "../services/trainers";
import { trainerCardStyle, trainerCoverStyle } from "../services/trainerCustomization";

export default function ChatProfilePreview({ username, ownProfile, isSelf, name, avatar, onClose }: {
  username?: string; ownProfile?: TrainerProfile | null; isSelf: boolean;
  name: string; avatar?: string | null; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{ profile: TrainerProfile | null; loading: boolean; error: string }>({ profile: null, loading: !isSelf && !!username, error: "" });
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    if (isSelf || !username) return;
    let active = true;
    getTrainerProfile(username).then((profile) => {
      if (active) setResult({ profile, loading: false, error: profile ? "" : "This trainer's shared profile is unavailable." });
    }).catch(() => {
      if (active) setResult({ profile: null, loading: false, error: "Unable to load this profile. Try opening their full profile." });
    });
    return () => { active = false; };
  }, [isSelf, username]);
  const profile = isSelf ? ownProfile : result.profile;
  return <dialog ref={dialogRef} className="chatProfileDialog" aria-labelledby="chat-profile-name"
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="chatProfileCard" style={trainerCardStyle(profile)}>
      <div className="chatProfileCover" style={trainerCoverStyle(profile)}>
        <button type="button" className="chatProfileClose" aria-label="Close profile preview" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="chatProfileBody">
        <span className="chatProfileAvatar">{profile?.avatar_url || avatar ? <img src={profile?.avatar_url || avatar || undefined} alt="" /> : <UserRound aria-hidden="true" />}</span>
        <h2 id="chat-profile-name">{profile?.display_name || name}</h2>
        {username && <p className="chatProfileHandle">@{username}</p>}
        {profile?.trainer_title && <p className="chatProfileTitle">{profile.trainer_title}</p>}
        {result.loading && <p role="status">Loading profile...</p>}
        {result.error && <p role="status">{result.error}</p>}
        {profile?.bio && <p className="chatProfileBio">{profile.bio}</p>}
        {profile?.favorite_game && <p className="chatProfileDetail"><small>Favorite game</small>{profile.favorite_game}</p>}
        {!!profile?.featured_team?.length && <div className="chatProfileTeam" aria-label="Featured team">{profile.featured_team.map((pokemon, index) =>
          <img key={`${pokemon.id}-${index}`} src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`} alt={pokemon.name} title={pokemon.name} />)}</div>}
        {(isSelf || username) && <Link className="chatProfileLink" to={isSelf ? "/profile" : `/trainers/${username}`} onClick={onClose}>{isSelf ? "Open my profile" : "View full profile"}</Link>}
      </div>
    </article>
  </dialog>;
}

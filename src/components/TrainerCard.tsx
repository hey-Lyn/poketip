import { ArrowUpRight, Calendar, Pencil, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { TrainerProfile } from "../services/trainers";
import { trainerCardStyle, trainerCoverStyle } from "../services/trainerCustomization";
import RequestConversationButton from "./RequestConversationButton";

function TrainerAvatar({ profile }: { profile: TrainerProfile }) {
  return (
    <div className="trainerAvatar">
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt="" loading="lazy" />
        : <UserRound aria-hidden="true" />}
    </div>
  );
}

function FavoritePokemon({ profile }: { profile: TrainerProfile }) {
  return (
    <div className="trainerFavorite">
      {profile.favorite_pokemon_id ? (
        <>
          <img
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${profile.favorite_pokemon_id}.png`}
            alt=""
            loading="lazy"
          />
          <div>
            <span>Favorite Pokémon</span>
            <strong>{profile.favorite_pokemon_name || `#${profile.favorite_pokemon_id}`}</strong>
          </div>
        </>
      ) : <span className="trainerHint">No favorite Pokémon yet</span>}
    </div>
  );
}

export default function TrainerCard({ profile, detailed = false, isSelf = false, allowChat = true }: {
  profile: TrainerProfile;
  detailed?: boolean;
  isSelf?: boolean;
  allowChat?: boolean;
}) {
  const name = profile.display_name.trim() || profile.username;
  const joined = new Date(profile.created_at);
  const memberSince = Number.isNaN(joined.getTime())
    ? null
    : joined.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (detailed) {
    return (
      <article className="trainerCardDetailed" style={trainerCardStyle(profile)}>
        <div className="trainerCover" style={trainerCoverStyle(profile)}>
          <span className="trainerSectionLabel">Pokétip · Trainer card</span>
          <span className="trainerCoverEmblem" aria-hidden="true" />
        </div>
        <div className="trainerProfileBody">
          <header className="trainerIdentity">
            <TrainerAvatar profile={profile} />
            <div className="trainerInfo">
              <div className="trainerNameLine">
                <h1>{name}</h1>
                {isSelf && <span className="trainerSelfBadge">You</span>}
              </div>
              <p className="trainerHandle">@{profile.username}</p>
              {profile.trainer_title && <p className="trainerTitle">{profile.trainer_title}</p>}
            </div>
          </header>
          <div className="trainerProfileSections">
            <section className="trainerAbout" aria-labelledby="trainer-about-title">
              <h2 id="trainer-about-title" className="trainerSectionLabel">About</h2>
              {profile.bio.trim()
                ? <p className="trainerBio">{profile.bio}</p>
                : <p className="trainerHint">This trainer hasn't added a bio yet.</p>}
            </section>
            <FavoritePokemon profile={profile} />
          </div>
          {profile.favorite_game && <section className="trainerGame"><h2 className="trainerSectionLabel">Favorite game</h2><p>{profile.favorite_game}</p></section>}
          {!!profile.featured_team?.length && (
            <section className="trainerFeaturedTeam" aria-label="Featured team">
              <h2 className="trainerSectionLabel">Featured team</h2>
              <ol>{profile.featured_team.map((member, index) => <li key={`${member.id}-${index}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${member.id}.png`} alt="" loading="lazy" /><span>{member.name}</span></li>)}</ol>
            </section>
          )}
          <footer className="trainerProfileFooter">
            {memberSince && (
              <p className="trainerJoined"><Calendar aria-hidden="true" /> Member since {memberSince}</p>
            )}
            {isSelf && (
              <Link className="trainerAction" to="/profile"><Pencil aria-hidden="true" /> Edit my profile</Link>
            )}
            {!isSelf && allowChat && <RequestConversationButton recipientId={profile.id} />}
          </footer>
        </div>
      </article>
    );
  }

  return (
    <Link
      className="trainerCard"
      style={trainerCardStyle(profile)}
      to={`/trainers/${profile.username}`}
      aria-label={`View ${name}'s profile`}
    >
      <div className="trainerSummary">
        <TrainerAvatar profile={profile} />
        <div className="trainerInfo">
          <div className="trainerNameLine">
            <h2>{name}</h2>
            {isSelf && <span className="trainerSelfBadge">You</span>}
          </div>
          <p className="trainerHandle">@{profile.username}</p>
          {profile.trainer_title && <p className="trainerTitle">{profile.trainer_title}</p>}
          {profile.bio.trim() && <p className="trainerBio">{profile.bio}</p>}
        </div>
      </div>
      <FavoritePokemon profile={profile} />
      <span className="trainerAction trainerViewProfile" aria-hidden="true">
        View profile <ArrowUpRight aria-hidden="true" />
      </span>
    </Link>
  );
}

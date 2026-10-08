import "./App.css";
import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Sparkles, TableOfContents, UserRound, UsersRound, IdCard, Settings, ShieldCheck, MessageCircle } from 'lucide-react';
import PokedexPage from "./components/PokedexPage";
import PokemonDetailsPage from "./components/PokemonDetailsPage";
import TeamBuilderPage from "./components/TeamBuilderPage";
import ProfilePage from "./components/ProfilePage";
import TrainersPage from "./components/TrainersPage";
import TrainerProfilePage from "./components/TrainerProfilePage";
import MessagesPage from "./components/MessagesPage";
import CallProvider from "./components/CallProvider";
import AdminPage from "./components/AdminPage";
import SettingsPage from "./components/SettingsPage";
import NotFoundPage from "./components/NotFoundPage";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { useSettings } from "./hooks/useSettings";
import { useBackgroundMotion } from "./hooks/useBackgroundMotion";
import {
  createTeamMember,
  loadTeam,
  loadTeamFormat,
  MAX_TEAM_SIZE,
  saveTeam,
  saveTeamFormat,
} from "./services/teamStorage";
import {
  DEFAULT_COMPETITIVE_FORMAT,
  getCompetitiveFormat,
} from "./services/showdownData";
import { listConversations, watchMessages } from "./services/messages";

function App() {
  const [settings, updateSettings] = useSettings();
  useBackgroundMotion(!settings.reduceMotion);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [team, setTeam] = useState(loadTeam);
  const [teamFormat, setTeamFormat] = useState(() =>
    getCompetitiveFormat(loadTeamFormat(DEFAULT_COMPETITIVE_FORMAT)).id,
  );
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const [unreadMessages, setUnreadMessages] = useState<{ userId: string | null; count: number }>({ userId: null, count: 0 });
  const isAdmin = profile?.role === "admin";
  const teamMemberCount = team.filter(Boolean).length;
  const unreadMessageCount = unreadMessages.userId === user?.id ? unreadMessages.count : 0;
  const hasDetailsBackground = location.pathname.startsWith("/pokemon/");
  const hasPokedexBackground = location.pathname === "/";
  const hasTeamBuilderBackground = location.pathname === "/team-builder";
  const hasProfileBackground = location.pathname === "/profile";
  const hasTrainersBackground = location.pathname === "/trainers" || location.pathname.startsWith("/trainers/") || location.pathname.startsWith("/messages");
  const hasSettingsBackground = location.pathname === "/settings";
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((open) => !open);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let active = true;
    const refreshUnread = () => {
      void listConversations().then((conversations) => {
        if (active) setUnreadMessages({ userId: user.id, count: conversations.reduce((total, conversation) => total + conversation.unread_count, 0) });
      }).catch(() => {
        // The sidebar indicator is supplementary; inbox errors are handled on the Messages page.
      });
    };
    const stopWatching = watchMessages(user.id, refreshUnread);
    refreshUnread();
    const onVisible = () => { if (document.visibilityState === "visible") refreshUnread(); };
    window.addEventListener("focus", refreshUnread);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 30000);

    return () => {
      active = false;
      stopWatching();
      window.removeEventListener("focus", refreshUnread);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen || typeof window === "undefined") return undefined;
    if (typeof window.matchMedia !== "function") return undefined;
    if (!window.matchMedia("(max-width: 768px)").matches) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => saveTeam(team), [team]);
  useEffect(() => saveTeamFormat(teamFormat), [teamFormat]);
  useEffect(() => {
    document.documentElement.classList.toggle("umbreon", settings.theme === "umbreon");
    document.documentElement.classList.toggle("shiny", settings.shiny);
  }, [settings.theme, settings.shiny]);

  function clearTeam() {
    setTeam(Array.from({ length: MAX_TEAM_SIZE }, () => null));
  }

  function addPokemonToTeam(pokemon) {
    setTeam((currentTeam) => {
      const alreadyAdded = currentTeam.some((member) => member?.id === pokemon.id);
      const availableSlot = currentTeam.findIndex((member) => !member);

      if (alreadyAdded || availableSlot === -1) {
        return currentTeam;
      }

      const nextTeam = [...currentTeam];
      nextTeam[availableSlot] = createTeamMember(pokemon);
      return nextTeam;
    });
  }

  function setPokemonInTeamSlot(slotIndex, pokemon) {
    setTeam((currentTeam) => {
      const alreadyAdded = currentTeam.some((member) => member?.id === pokemon.id);
      if (alreadyAdded || slotIndex < 0 || slotIndex >= MAX_TEAM_SIZE) {
        return currentTeam;
      }

      const nextTeam = [...currentTeam];
      nextTeam[slotIndex] = createTeamMember(pokemon);
      return nextTeam;
    });
  }

  function removePokemonFromTeam(slotIndex) {
    setTeam((currentTeam) => {
      const nextTeam = [...currentTeam];
      nextTeam[slotIndex] = null;
      return nextTeam;
    });
  }

  function updatePokemonInTeam(slotIndex, settings) {
    setTeam((currentTeam) => {
      if (!currentTeam[slotIndex]) return currentTeam;

      const nextTeam = [...currentTeam];
      nextTeam[slotIndex] = { ...nextTeam[slotIndex], ...settings };
      return nextTeam;
    });
  }

  function importTeam(importedTeam) {
    setTeam(Array.from(
      { length: MAX_TEAM_SIZE },
      (_, index) => importedTeam[index] ?? null,
    ));
  }

  function movePokemonInTeam(index, direction) {
    setTeam((currentTeam) => {
      const destination = index + direction;
      if (destination < 0 || destination >= currentTeam.length) return currentTeam;

      const reorderedTeam = [...currentTeam];
      [reorderedTeam[index], reorderedTeam[destination]] =
        [reorderedTeam[destination], reorderedTeam[index]];
      return reorderedTeam;
    });
  }

  return (
    <CallProvider userId={user?.id ?? null}>
    <div className={`app ${hasDetailsBackground ? "pokemonDetailsBackground" : ""} ${hasPokedexBackground ? "pokedexBackground" : ""} ${hasTeamBuilderBackground ? "teamBuilderBackground" : ""} ${hasProfileBackground ? "profileBackground" : ""} ${hasTrainersBackground ? "trainersBackground" : ""} ${hasSettingsBackground ? "settingsBackground" : ""}${settings.reduceMotion ? " reduceMotion" : ""}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebarScrim"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      )}
      <aside id="primary-sidebar" className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button
          className="menuButton"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="primary-sidebar"
        >
          <TableOfContents />
        </button>
        <nav className="sidebarNav" aria-label="Primary">
          <NavLink end to="/" onClick={closeSidebar} title="Pokédex" aria-label="Pokédex">
            <span className="sidebarIcon" aria-hidden="true"><IdCard /><IdCard className="sidebarIconAccent" /></span>
            <span className="sidebarLabel" aria-hidden="true">Pokédex</span>
          </NavLink>
          <NavLink end
            to="/team-builder"
            onClick={closeSidebar}
            title="Team Builder"
            aria-label="Open Team Builder"
          >
            <span className="sidebarIcon" aria-hidden="true"><Sparkles /><Sparkles className="sidebarIconAccent" /></span>
            <span className="sidebarLabel" aria-hidden="true">Team Build ({teamMemberCount}/6)</span>
          </NavLink>
          <NavLink end to="/profile" onClick={closeSidebar} title="Profile" aria-label="Profile">
            <span className="sidebarIcon" aria-hidden="true"><UserRound /><UserRound className="sidebarIconAccent" /></span>
            <span className="sidebarLabel" aria-hidden="true">Profile</span>
          </NavLink>
          <NavLink to="/trainers" onClick={closeSidebar} title="Trainers" aria-label="Trainers">
            <span className="sidebarIcon" aria-hidden="true"><UsersRound /><UsersRound className="sidebarIconAccent" /></span>
            <span className="sidebarLabel" aria-hidden="true">Trainers</span>
          </NavLink>
          <NavLink to="/messages" onClick={closeSidebar} title={unreadMessageCount ? `Messages · ${unreadMessageCount} unread` : "Messages"} aria-label={unreadMessageCount ? `Messages, ${unreadMessageCount} unread messages` : "Messages"}>
            <span className="sidebarIcon" aria-hidden="true"><MessageCircle /><MessageCircle className="sidebarIconAccent" /></span>
            {unreadMessageCount > 0 && <span className="sidebarUnreadBadge" aria-hidden="true">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>}
            <span className="sidebarLabel" aria-hidden="true">Messages{unreadMessageCount > 0 ? ` (${unreadMessageCount > 99 ? "99+" : unreadMessageCount})` : ""}</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" onClick={closeSidebar} title="Admin" aria-label="Admin">
              <span className="sidebarIcon" aria-hidden="true"><ShieldCheck /><ShieldCheck className="sidebarIconAccent" /></span>
              <span className="sidebarLabel" aria-hidden="true">Admin</span>
            </NavLink>
          )}
          <NavLink end to="/settings" onClick={closeSidebar} title="Settings" aria-label="Settings">
            <span className="sidebarIcon" aria-hidden="true"><Settings /><Settings className="sidebarIconAccent" /></span>
            <span className="sidebarLabel" aria-hidden="true">Settings</span>
          </NavLink>
        </nav>
      </aside>

      <Routes>
        <Route
          path="/"
          element={(
            <PokedexPage team={team} onAddToTeam={addPokemonToTeam} />
          )}
        />
        <Route path="/pokemon/:pokemonId" element={<PokemonDetailsPage />} />
        <Route
          path="/team-builder"
          element={(
            <TeamBuilderPage
              team={team}
              format={teamFormat}
              onFormatChange={setTeamFormat}
              onImportTeam={importTeam}
              onMovePokemon={movePokemonInTeam}
              onRemovePokemon={removePokemonFromTeam}
              onSetPokemon={setPokemonInTeamSlot}
              onUpdatePokemon={updatePokemonInTeam}
            />
          )}
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/trainers" element={<TrainersPage />} />
        <Route path="/trainers/:username" element={<TrainerProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:conversationId" element={<MessagesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="/settings"
          element={(
            <SettingsPage
              settings={settings}
              team={team}
              user={user}
              onClearTeam={clearTeam}
              onUpdate={updateSettings}
            />
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
    </CallProvider>
  );
}

export default App; 

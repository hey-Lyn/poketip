import "./App.css";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, TableOfContents, UserRound, IdCard, Settings, ShieldCheck } from 'lucide-react';
import PokedexPage from "./components/PokedexPage";
import PokemonDetailsPage from "./components/PokemonDetailsPage";
import TeamBuilderPage from "./components/TeamBuilderPage";
import ProfilePage from "./components/ProfilePage";
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

function App() {
  const [settings, updateSettings] = useSettings();
  useBackgroundMotion(!settings.reduceMotion);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [team, setTeam] = useState(loadTeam);
  const [teamFormat, setTeamFormat] = useState(() =>
    getCompetitiveFormat(loadTeamFormat(DEFAULT_COMPETITIVE_FORMAT)).id,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const isAdmin = profile?.role === "admin";
  const teamMemberCount = team.filter(Boolean).length;
  const hasDetailsBackground = location.pathname.startsWith("/pokemon/");
  const hasPokedexBackground = location.pathname === "/";
  const hasTeamBuilderBackground = location.pathname === "/team-builder";
  const hasProfileBackground = location.pathname === "/profile";
  const hasSettingsBackground = location.pathname === "/settings";
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((open) => !open);
  const openPokedex = () => {
    navigate("/");
    closeSidebar();
  };

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

  function openTeamBuilder() {
    navigate("/team-builder");
    closeSidebar();
  }
  return (
    <div className={`app ${hasDetailsBackground ? "pokemonDetailsBackground" : ""} ${hasPokedexBackground ? "pokedexBackground" : ""} ${hasTeamBuilderBackground ? "teamBuilderBackground" : ""} ${hasProfileBackground ? "profileBackground" : ""} ${hasSettingsBackground ? "settingsBackground" : ""}${settings.reduceMotion ? " reduceMotion" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="menuButton" onClick={toggleSidebar}>
          <TableOfContents />
        </button>
        <button onClick={openPokedex}>  <IdCard /> {sidebarOpen && <span>Pokédex</span>}</button>
        <button onClick={openTeamBuilder} aria-label="Open Team Builder">
          <Sparkles /> {sidebarOpen && <span>Team Build ({teamMemberCount}/6)</span>}
        </button>
        <button onClick={() => { navigate("/profile"); closeSidebar(); }}><UserRound /> {sidebarOpen && <span>Profile</span>}</button>
        {isAdmin && (
          <button onClick={() => { navigate("/admin"); closeSidebar(); }}>
            <ShieldCheck /> {sidebarOpen && <span>Admin</span>}
          </button>
        )}
        <button onClick={() => { navigate("/settings"); closeSidebar(); }}><Settings /> {sidebarOpen && <span>Settings</span>}</button>
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
  );
}

export default App; 

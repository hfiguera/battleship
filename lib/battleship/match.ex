defmodule Battleship.Match do
  @moduledoc false

  @ships [
    {"carrier", 5},
    {"battleship", 4},
    {"cruiser", 3},
    {"submarine", 3},
    {"destroyer", 2}
  ]

  @type cell :: {0..9, 1..10}
  @type fleet :: %{ships: [map()], occupied: %{cell() => non_neg_integer()}}
  @type t :: %{
          yours: fleet(),
          theirs: fleet(),
          your_shots: MapSet.t(),
          their_shots: MapSet.t(),
          winner: String.t() | nil,
          log: [map()],
          player_misses: non_neg_integer(),
          admiral_misses: non_neg_integer(),
          player_hits: non_neg_integer(),
          admiral_hits: non_neg_integer(),
          player_sinks: non_neg_integer(),
          admiral_sinks: non_neg_integer()
        }

  @spec new() :: t()
  def new do
    %{
      yours: place_fleet(),
      theirs: place_fleet(),
      your_shots: MapSet.new(),
      their_shots: MapSet.new(),
      winner: nil,
      log: [],
      player_misses: 0,
      admiral_misses: 0,
      player_hits: 0,
      admiral_hits: 0,
      player_sinks: 0,
      admiral_sinks: 0
    }
  end

  @spec player_shot(t(), term()) :: {t(), map()}
  def player_shot(%{winner: winner} = match, _raw) when is_binary(winner) do
    {match, already_over(winner)}
  end

  def player_shot(match, raw) do
    case Battleship.Coordinate.parse(raw) do
      :error ->
        {match, rejected("[calm] Say a letter A through J, then a number 1 through 10.")}

      {:ok, cell} ->
        fire(match, :theirs, cell, :player)
    end
  end

  @spec opponent_shot(t()) :: {t(), map()}
  def opponent_shot(%{winner: winner} = match) when is_binary(winner) do
    {match, already_over(winner)}
  end

  def opponent_shot(match) do
    case choose_cell(match.yours, match.your_shots) do
      nil ->
        {match, rejected("[calm] No squares left.")}

      cell ->
        fire(match, :yours, cell, :opponent)
    end
  end

  @spec view(t()) :: map()
  def view(match) do
    %{
      "yours" => fleet_view(match.yours),
      "theirs" => fleet_view(match.theirs),
      "shots" => Enum.reverse(match.log),
      "winner" => match.winner || ""
    }
  end

  defp fire(match, board, cell, shooter) do
    fleet_key = board
    shots_key = if board == :yours, do: :your_shots, else: :their_shots
    fleet = Map.fetch!(match, fleet_key)
    shots = Map.fetch!(match, shots_key)
    label = Battleship.Coordinate.label(cell)

    cond do
      MapSet.member?(shots, cell) ->
        {match, rejected("[annoyed] #{label} was already called. [calm] Pick another square.")}

      true ->
        shots = MapSet.put(shots, cell)
        {result, ship_name, sunk?} = classify(fleet, cell, shots)
        winner = winner(fleet, shots, board, match.winner)
        entry = shot_entry(board, label, result, ship_name, sunk?)

        match = %{
          match
          | shots_key => shots,
            winner: winner,
            log: [entry | match.log]
        }

        {misses, hits, sinks, match} = bump_streak(match, shooter, result, sunk?)

        {match,
         accepted(shooter, board, label, result, ship_name, sunk?, winner, misses, hits, sinks)}
    end
  end

  defp classify(fleet, cell, shots) do
    case Map.fetch(fleet.occupied, cell) do
      :error ->
        {:miss, nil, false}

      {:ok, index} ->
        ship = Enum.at(fleet.ships, index)
        sunk? = Enum.all?(ship.cells, &MapSet.member?(shots, &1))
        {:hit, ship.name, sunk?}
    end
  end

  defp winner(fleet, shots, :theirs, _current) do
    if fleet_sunk?(fleet, shots), do: "player", else: nil
  end

  defp winner(fleet, shots, :yours, _current) do
    if fleet_sunk?(fleet, shots), do: "agent", else: nil
  end

  defp fleet_sunk?(fleet, shots) do
    Enum.all?(fleet.ships, fn ship -> Enum.all?(ship.cells, &MapSet.member?(shots, &1)) end)
  end

  defp choose_cell(fleet, shots) do
    open = for col <- 0..9, row <- 1..10, not MapSet.member?(shots, {col, row}), do: {col, row}

    hunt =
      fleet.ships
      |> Enum.reject(fn ship -> Enum.all?(ship.cells, &MapSet.member?(shots, &1)) end)
      |> Enum.flat_map(fn ship -> Enum.filter(ship.cells, &MapSet.member?(shots, &1)) end)
      |> Enum.flat_map(&neighbors/1)
      |> Enum.filter(&(&1 in open))
      |> Enum.uniq()

    pool = if hunt == [], do: open, else: hunt

    case pool do
      [] -> nil
      cells -> Enum.random(cells)
    end
  end

  defp neighbors({col, row}) do
    [{col - 1, row}, {col + 1, row}, {col, row - 1}, {col, row + 1}]
    |> Enum.filter(fn {c, r} -> c in 0..9 and r in 1..10 end)
  end

  defp place_fleet do
    Enum.reduce(@ships, %{ships: [], occupied: %{}}, fn ship, fleet ->
      drop_ship(fleet, ship, 0)
    end)
  end

  defp drop_ship(_fleet, {_name, _len}, 400), do: raise("could not place a fleet")

  defp drop_ship(fleet, {name, len} = ship, attempt) do
    horizontal? = :rand.uniform(2) == 1
    col = :rand.uniform(if(horizontal?, do: 11 - len, else: 10)) - 1
    row = :rand.uniform(if(horizontal?, do: 10, else: 11 - len))

    cells =
      if horizontal? do
        Enum.map(0..(len - 1), &{col + &1, row})
      else
        Enum.map(0..(len - 1), &{col, row + &1})
      end

    if Enum.any?(cells, &Map.has_key?(fleet.occupied, &1)) do
      drop_ship(fleet, ship, attempt + 1)
    else
      index = length(fleet.ships)

      occupied =
        Enum.reduce(cells, fleet.occupied, fn cell, acc -> Map.put(acc, cell, index) end)

      %{fleet | ships: fleet.ships ++ [%{name: name, cells: cells}], occupied: occupied}
    end
  end

  defp fleet_view(fleet) do
    Enum.map(fleet.ships, fn ship ->
      %{
        "name" => ship.name,
        "cells" => Enum.map(ship.cells, &Battleship.Coordinate.label/1)
      }
    end)
  end

  defp shot_entry(board, label, result, ship_name, sunk?) do
    %{
      "side" => Atom.to_string(board),
      "coordinate" => label,
      "result" => Atom.to_string(result),
      "ship" => ship_name || "",
      "sunk" => if(sunk?, do: "yes", else: "no")
    }
  end

  defp rejected(line) do
    reply("no", "invalid", "", "", false, "no", "", line)
  end

  defp already_over(winner) do
    reply("no", "over", "", "", false, "yes", winner, "[sighs] The match is already over.")
  end

  defp bump_streak(match, shooter, :miss, _sunk?) do
    misses = Map.get(match, miss_key(shooter), 0) + 1

    match =
      match
      |> Map.put(miss_key(shooter), misses)
      |> Map.put(hit_key(shooter), 0)

    {misses, 0, Map.get(match, sink_key(shooter), 0), match}
  end

  defp bump_streak(match, shooter, :hit, sunk?) do
    hits = Map.get(match, hit_key(shooter), 0) + 1
    sinks = Map.get(match, sink_key(shooter), 0) + if(sunk?, do: 1, else: 0)

    match =
      match
      |> Map.put(miss_key(shooter), 0)
      |> Map.put(hit_key(shooter), hits)
      |> Map.put(sink_key(shooter), sinks)

    {0, hits, sinks, match}
  end

  defp miss_key(:player), do: :player_misses
  defp miss_key(:opponent), do: :admiral_misses
  defp hit_key(:player), do: :player_hits
  defp hit_key(:opponent), do: :admiral_hits
  defp sink_key(:player), do: :player_sinks
  defp sink_key(:opponent), do: :admiral_sinks

  defp accepted(shooter, board, label, result, ship_name, sunk?, winner, misses, hits, sinks) do
    reply(
      "yes",
      Atom.to_string(result),
      Atom.to_string(board),
      label,
      sunk?,
      if(winner, do: "yes", else: "no"),
      winner || "",
      voice(shooter, label, result, ship_name, sunk?, winner, misses, hits, sinks)
    )
    |> Map.put("ship", ship_name || "")
  end

  defp reply(accepted, result, board, label, sunk?, game_over, winner, line) do
    %{
      "accepted" => accepted,
      "result" => result,
      "board" => board,
      "coordinate" => label,
      "ship" => "",
      "sunk" => if(sunk?, do: "yes", else: "no"),
      "game_over" => game_over,
      "winner" => winner,
      "voice" => line,
      "spoken" => caption(line)
    }
  end

  defp caption(line) do
    line
    |> String.replace(~r/\[[^\]]*\]\s*/, "")
    |> String.replace(~r/[ \t]{2,}/, " ")
    |> String.trim()
  end

  defp voice(:player, label, :miss, _ship, _sunk?, _winner, 1, _hits, _sinks),
    do: "[calm] #{label}. You missed."

  defp voice(:player, label, :miss, _ship, _sunk?, _winner, 2, _hits, _sinks),
    do: "[chuckles] #{label}. You missed again."

  defp voice(:player, label, :miss, _ship, _sunk?, _winner, 3, _hits, _sinks),
    do: "[laughs] #{label}. You missed. [short pause] That's three."

  defp voice(:player, label, :miss, _ship, _sunk?, _winner, count, _hits, _sinks) when count >= 4,
    do: "[laughs] #{label}. You missed. [chuckles] I'm enjoying this."

  defp voice(:player, label, :hit, ship, true, "player", _misses, _hits, _sinks),
    do: "[sad] #{label} sinks the #{ship}. [sighs] You win. [chuckles] I demand a rematch."

  defp voice(:player, label, :hit, ship, true, _winner, _misses, _hits, 1),
    do: "[surprised] #{label}. [short pause] [excited] That sinks the #{ship}."

  defp voice(:player, label, :hit, ship, true, _winner, _misses, _hits, 2),
    do: "[sad] #{label}. [sighs] That sinks the #{ship}. That's two."

  defp voice(:player, label, :hit, ship, true, _winner, _misses, _hits, 3),
    do: "[angry] #{label}. [annoyed] That sinks the #{ship}. I am running out of ships."

  defp voice(:player, label, :hit, ship, true, _winner, _misses, _hits, sinks) when sinks >= 4,
    do: "[sad] #{label}. [sighs] That sinks the #{ship}. [whisper] One ship left."

  defp voice(:player, label, :hit, _ship, false, _winner, _misses, 1, _sinks),
    do: "[excited] #{label} is a hit. [happy] The ship is burning."

  defp voice(:player, label, :hit, _ship, false, _winner, _misses, 2, _sinks),
    do: "[sad] #{label} is a hit. [sighs] Not again."

  defp voice(:player, label, :hit, _ship, false, _winner, _misses, 3, _sinks),
    do: "[sad] #{label} is a hit. [sighs] That's three. That hurts."

  defp voice(:player, label, :hit, _ship, false, _winner, _misses, hits, _sinks) when hits >= 4,
    do: "[angry] #{label} is a hit. [annoyed] Enough."

  defp voice(:opponent, label, :miss, _ship, _sunk?, _winner, 1, _hits, _sinks),
    do: "[calm] My shot is #{label}. [sighs] Open water. I missed."

  defp voice(:opponent, label, :miss, _ship, _sunk?, _winner, 2, _hits, _sinks),
    do: "[sad] My shot is #{label}. [sighs] Open water. I missed again."

  defp voice(:opponent, label, :miss, _ship, _sunk?, _winner, 3, _hits, _sinks),
    do: "[sad] My shot is #{label}. [sighs] Three in a row. I missed."

  defp voice(:opponent, label, :miss, _ship, _sunk?, _winner, count, _hits, _sinks)
       when count >= 4,
       do: "[angry] My shot is #{label}. [annoyed] I missed. The ocean is against me."

  defp voice(:opponent, label, :hit, ship, true, "agent", _misses, _hits, _sinks),
    do:
      "[laughs] My shot is #{label}. [excited] That sinks your #{ship}. [chuckles] I win. [happy] Try to smile."

  defp voice(:opponent, label, :hit, ship, true, _winner, _misses, _hits, 1),
    do: "[calm] My shot is #{label}. [excited] That sinks your #{ship}."

  defp voice(:opponent, label, :hit, ship, true, _winner, _misses, _hits, 2),
    do: "[chuckles] My shot is #{label}. [excited] That sinks your #{ship}. Two down."

  defp voice(:opponent, label, :hit, ship, true, _winner, _misses, _hits, 3),
    do: "[laughs] My shot is #{label}. [happy] That sinks your #{ship}. You're running out."

  defp voice(:opponent, label, :hit, ship, true, _winner, _misses, _hits, sinks) when sinks >= 4,
    do: "[laughs] My shot is #{label}. [whisper] That sinks your #{ship}. One ship left."

  defp voice(:opponent, label, :hit, _ship, false, _winner, _misses, 1, _sinks),
    do: "[happy] My shot is #{label}, a hit."

  defp voice(:opponent, label, :hit, _ship, false, _winner, _misses, 2, _sinks),
    do: "[chuckles] My shot is #{label}, a hit. [happy] Again."

  defp voice(:opponent, label, :hit, _ship, false, _winner, _misses, 3, _sinks),
    do: "[laughs] My shot is #{label}, a hit. [short pause] That's three."

  defp voice(:opponent, label, :hit, _ship, false, _winner, _misses, hits, _sinks) when hits >= 4,
    do: "[laughs] My shot is #{label}, a hit. [chuckles] I could do this all day."
end

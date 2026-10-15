defmodule Battleship.MatchTest do
  use ExUnit.Case, async: true

  alias Battleship.Match

  test "a repeated square is refused and a full sweep wins" do
    match = Match.new()
    {match, first} = Match.player_shot(match, "B7")
    assert first["accepted"] == "yes"
    assert first["spoken"] =~ "B7"
    refute first["spoken"] =~ "["
    assert first["voice"] =~ "B7"

    {match, again} = Match.player_shot(match, "be seven")
    assert again["accepted"] == "no"
    assert again["spoken"] =~ "already called"

    squares = for col <- ?A..?J, row <- 1..10, do: <<col::utf8>> <> Integer.to_string(row)

    match =
      Enum.reduce(squares, match, fn square, match ->
        {match, _reply} = Match.player_shot(match, square)
        match
      end)

    assert match.winner == "player"
  end

  test "the last hit on a ship is marked sunk" do
    match = Match.new()
    ship = hd(match.theirs.ships)

    {_match, reply} =
      Enum.reduce(ship.cells, {match, nil}, fn cell, {match, _} ->
        Match.player_shot(match, Battleship.Coordinate.label(cell))
      end)

    assert reply["sunk"] == "yes"
    assert reply["ship"] == ship.name
    assert reply["result"] == "hit"
    assert reply["spoken"] =~ "sinks the #{ship.name}"
    refute reply["spoken"] =~ "["
    assert reply["voice"] =~ "[excited]"
  end

  test "the admiral names the square it fires" do
    {_match, reply} = Match.opponent_shot(Match.new())
    assert reply["accepted"] == "yes"
    assert reply["spoken"] =~ "My shot is"
    refute reply["spoken"] =~ "["
    assert reply["voice"] =~ "My shot is"
  end

  test "misses in a row change the admiral's mood, and a hit clears it" do
    match = Match.new()
    [first, second, third, fourth, reset] = empty_labels(match.theirs, 5)

    {match, reply} = Match.player_shot(match, first)
    assert reply["voice"] == "[calm] #{first}. You missed."
    assert reply["spoken"] == "#{first}. You missed."

    {match, again} = Match.player_shot(match, first)
    assert again["accepted"] == "no"

    {match, reply} = Match.player_shot(match, second)
    assert reply["voice"] == "[chuckles] #{second}. You missed again."
    assert reply["spoken"] == "#{second}. You missed again."

    {match, reply} = Match.player_shot(match, third)
    assert reply["voice"] == "[laughs] #{third}. You missed. [short pause] That's three."
    assert reply["spoken"] == "#{third}. You missed. That's three."

    {match, reply} = Match.player_shot(match, fourth)
    assert reply["voice"] == "[laughs] #{fourth}. You missed. [chuckles] I'm enjoying this."
    refute reply["spoken"] =~ "["

    cell = hd(hd(match.theirs.ships).cells)
    {match, hit} = Match.player_shot(match, Battleship.Coordinate.label(cell))
    assert hit["result"] == "hit"

    {_match, reply} = Match.player_shot(match, reset)
    assert reply["voice"] == "[calm] #{reset}. You missed."
  end

  test "hits in a row hurt, a miss clears them, and the last ship demands a rematch" do
    match = Match.new()
    carrier = Enum.find(match.theirs.ships, &(&1.name == "carrier"))
    [one, two, three, four, five] = Enum.map(carrier.cells, &Battleship.Coordinate.label/1)

    {match, reply} = Match.player_shot(match, one)
    assert reply["spoken"] == "#{one} is a hit. The ship is burning."

    {match, reply} = Match.player_shot(match, two)
    assert reply["spoken"] == "#{two} is a hit. Not again."

    {match, reply} = Match.player_shot(match, three)
    assert reply["spoken"] == "#{three} is a hit. That's three. That hurts."

    {match, reply} = Match.player_shot(match, four)
    assert reply["voice"] == "[angry] #{four} is a hit. [annoyed] Enough."

    {match, reply} = Match.player_shot(match, five)
    assert reply["sunk"] == "yes"
    assert reply["spoken"] == "#{five}. That sinks the carrier."

    [miss | _] = empty_labels(match.theirs, 1)
    {match, reply} = Match.player_shot(match, miss)
    assert reply["result"] == "miss"

    battleship = Enum.find(match.theirs.ships, &(&1.name == "battleship"))
    next = Battleship.Coordinate.label(hd(battleship.cells))
    {match, reply} = Match.player_shot(match, next)
    assert reply["spoken"] == "#{next} is a hit. The ship is burning."

    {match, two} = sink_ship(match, battleship)
    [cruiser, submarine, destroyer] = Enum.drop(match.theirs.ships, 2)
    {match, three} = sink_ship(match, cruiser)
    {match, four} = sink_ship(match, submarine)
    {match, win} = sink_ship(match, destroyer)

    assert two["spoken"] =~ "That's two."
    assert three["spoken"] =~ "I am running out of ships."
    assert four["spoken"] =~ "One ship left."
    assert win["spoken"] =~ "You win. I demand a rematch."
    assert win["voice"] =~ "[chuckles]"
    refute win["spoken"] =~ "["
    assert match.winner == "player"
  end

  test "the admiral enjoys his own hits, and smiles when he wins" do
    [first, second] = opening_plain_hits(2)
    assert first["spoken"] =~ "a hit"
    refute first["spoken"] =~ "Again"
    assert second["spoken"] =~ "a hit. Again."

    [_, two_down] = admiral_sinks(2)
    assert two_down["spoken"] =~ "Two down."

    win = play_until_admiral_wins(Match.new(), 100)
    assert win["spoken"] =~ "I win. Try to smile."
    assert win["voice"] =~ "[laughs]"
    refute win["spoken"] =~ "["
  end

  test "the admiral sulks, then gets angry, when his own shots miss in a row" do
    [first, second, third, fourth] = opening_admiral_misses(4)

    assert first["voice"] ==
             "[calm] My shot is #{first["coordinate"]}. [sighs] Open water. I missed."

    assert second["spoken"] == "My shot is #{second["coordinate"]}. Open water. I missed again."
    assert third["spoken"] == "My shot is #{third["coordinate"]}. Three in a row. I missed."

    assert fourth["voice"] ==
             "[angry] My shot is #{fourth["coordinate"]}. [annoyed] I missed. The ocean is against me."

    refute fourth["spoken"] =~ "["
  end

  defp empty_labels(fleet, count) do
    occupied = MapSet.new(Map.keys(fleet.occupied))

    for col <- 0..9, row <- 1..10, {col, row} not in occupied do
      Battleship.Coordinate.label({col, row})
    end
    |> Enum.take(count)
  end

  defp opening_admiral_misses(count) do
    Enum.find_value(1..20, fn _ ->
      misses = take_opening_misses(Match.new(), [])
      if length(misses) >= count, do: Enum.take(misses, count)
    end) || flunk("the admiral did not miss #{count} times before a hit")
  end

  defp sink_ship(match, ship) do
    Enum.reduce(ship.cells, {match, nil}, fn cell, {match, _} ->
      Match.player_shot(match, Battleship.Coordinate.label(cell))
    end)
  end

  defp opening_plain_hits(count) do
    Enum.find_value(1..40, fn _ ->
      hits = take_plain_hits(Match.new(), [])
      if length(hits) >= count, do: Enum.take(hits, count)
    end) || flunk("the admiral did not hit #{count} times before a miss")
  end

  defp take_plain_hits(match, hits) do
    {match, reply} = Match.opponent_shot(match)

    if reply["result"] == "hit" and reply["sunk"] == "no" do
      take_plain_hits(match, hits ++ [reply])
    else
      hits
    end
  end

  defp admiral_sinks(count) do
    Enum.find_value(1..15, fn _ ->
      sinks = collect_sinks(Match.new(), [], count, 100)
      if length(sinks) >= count, do: Enum.take(sinks, count)
    end) || flunk("the admiral did not sink #{count} ships")
  end

  defp collect_sinks(_match, sinks, _count, 0), do: sinks

  defp collect_sinks(match, sinks, count, left) do
    if length(sinks) >= count or match.winner do
      sinks
    else
      {match, reply} = Match.opponent_shot(match)

      sinks =
        if reply["sunk"] == "yes" and reply["winner"] != "agent" do
          sinks ++ [reply]
        else
          sinks
        end

      collect_sinks(match, sinks, count, left - 1)
    end
  end

  defp play_until_admiral_wins(_match, 0), do: flunk("the admiral never won")

  defp play_until_admiral_wins(match, left) do
    {match, reply} = Match.opponent_shot(match)

    if reply["winner"] == "agent" do
      reply
    else
      play_until_admiral_wins(match, left - 1)
    end
  end

  defp take_opening_misses(match, misses) do
    {match, reply} = Match.opponent_shot(match)

    if reply["result"] == "miss" do
      take_opening_misses(match, misses ++ [reply])
    else
      misses
    end
  end
end

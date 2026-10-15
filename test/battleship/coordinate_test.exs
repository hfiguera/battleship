defmodule Battleship.CoordinateTest do
  use ExUnit.Case, async: true

  alias Battleship.Coordinate

  test "reads a typed square and a spoken square" do
    assert Coordinate.parse("B7") == {:ok, {1, 7}}
    assert Coordinate.parse("be seven") == {:ok, {1, 7}}
    assert Coordinate.parse("bravo 10") == {:ok, {1, 10}}
    assert Coordinate.parse("j ten") == {:ok, {9, 10}}
    assert Coordinate.parse("hello") == :error
  end

  test "labels a cell" do
    assert Coordinate.label({1, 7}) == "B7"
  end
end

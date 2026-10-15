defmodule Battleship.Coordinate do
  @moduledoc false

  @letters %{
    "a" => 0,
    "alpha" => 0,
    "b" => 1,
    "be" => 1,
    "bee" => 1,
    "bravo" => 1,
    "c" => 2,
    "see" => 2,
    "sea" => 2,
    "charlie" => 2,
    "d" => 3,
    "dee" => 3,
    "delta" => 3,
    "e" => 4,
    "echo" => 4,
    "f" => 5,
    "ef" => 5,
    "foxtrot" => 5,
    "g" => 6,
    "gee" => 6,
    "golf" => 6,
    "h" => 7,
    "aitch" => 7,
    "hotel" => 7,
    "i" => 8,
    "eye" => 8,
    "india" => 8,
    "j" => 9,
    "jay" => 9,
    "juliet" => 9
  }

  @numbers %{
    "1" => 1,
    "one" => 1,
    "won" => 1,
    "2" => 2,
    "two" => 2,
    "to" => 2,
    "too" => 2,
    "3" => 3,
    "three" => 3,
    "4" => 4,
    "four" => 4,
    "for" => 4,
    "5" => 5,
    "five" => 5,
    "6" => 6,
    "six" => 6,
    "7" => 7,
    "seven" => 7,
    "8" => 8,
    "eight" => 8,
    "ate" => 8,
    "9" => 9,
    "nine" => 9,
    "10" => 10,
    "ten" => 10
  }

  @doc """
  Turns a spoken or typed square into `{column, row}`.

  Accepts `B7`, `b 7`, `be seven`, and `bravo seven`.
  """
  @spec parse(term()) :: {:ok, {0..9, 1..10}} | :error
  def parse(raw) when is_binary(raw) do
    raw
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/u, " ")
    |> String.split(" ", trim: true)
    |> find_pair()
  end

  def parse(_raw), do: :error

  @spec label({non_neg_integer(), pos_integer()}) :: String.t()
  def label({col, row}) when col in 0..9 and row in 1..10 do
    <<?A + col::utf8>> <> Integer.to_string(row)
  end

  defp find_pair([token | rest]) do
    case glued(token) do
      {:ok, coord} ->
        {:ok, coord}

      :error ->
        case rest do
          [next | _] ->
            case {letter(token), number(next)} do
              {{:ok, col}, {:ok, row}} -> {:ok, {col, row}}
              _ -> find_pair(rest)
            end

          [] ->
            :error
        end
    end
  end

  defp find_pair([]), do: :error

  defp glued(token) do
    case Regex.run(~r/\A([a-j])(10|[1-9])\z/, token) do
      [_, letter, row] ->
        {:ok, {Map.fetch!(@letters, letter), String.to_integer(row)}}

      _ ->
        :error
    end
  end

  defp letter(token), do: fetch(@letters, token)
  defp number(token), do: fetch(@numbers, token)

  defp fetch(map, token) do
    case Map.fetch(map, token) do
      {:ok, value} -> {:ok, value}
      :error -> :error
    end
  end
end

{:ok, _} = Application.ensure_all_started(:ecto_sql)
{:ok, _} = Application.ensure_all_started(:phoenix_pubsub)
{:ok, _} = MaestroPlatform.Repo.start_link()

{:ok, _} =
  Supervisor.start_link([{Phoenix.PubSub, name: MaestroPlatform.PubSub}], strategy: :one_for_one)

yaml =
  "../battleship/priv/maestro/battleship.yaml"
  |> Path.expand(File.cwd!())
  |> File.read!()

alias MaestroPlatform.Agents
alias MaestroPlatform.Agents.Agent
alias MaestroPlatform.Repo

tenant_id = 1
user_id = 1

agent =
  case Repo.get_by(Agent, tenant_id: tenant_id, slug: "battleship") do
    nil ->
      {:ok, created} =
        Agents.create_agent(
          %{
            "name" => "Battleship",
            "description" => "Voice admiral for the battleship board.",
            "execution_mode" => "deterministic",
            "version" => "1.0.0"
          },
          tenant_id,
          user_id
        )

      created

    existing ->
      existing
  end

{:ok, agent, _channels_resynced?} =
  Agents.save_agent_yaml(agent, yaml, "battleship.yaml", user_id)

{:ok, agent} = Agents.compile_agent(agent, user_id)

final =
  Enum.reduce_while(1..40, agent, fn _, current ->
    Process.sleep(500)
    fresh = Repo.get!(Agent, current.id)

    if fresh.status in ["compiled", "compile_error"] do
      {:halt, fresh}
    else
      {:cont, fresh}
    end
  end)

IO.puts("agent_id=#{final.id} status=#{final.status}")

if final.compile_error do
  IO.puts(final.compile_error)
  System.halt(1)
end

CREATE OR REPLACE FUNCTION public.sync_game_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.games
  SET
    score_a = (
      SELECT COUNT(*)::integer
      FROM public.score_events
      WHERE game_id = NEW.game_id
        AND team = 'team_a'
        AND voided_at IS NULL
    ),
    score_b = (
      SELECT COUNT(*)::integer
      FROM public.score_events
      WHERE game_id = NEW.game_id
        AND team = 'team_b'
        AND voided_at IS NULL
    )
  WHERE id = NEW.game_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_score_events_update_game_score
  AFTER INSERT OR UPDATE OF voided_at
  ON public.score_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_game_score();

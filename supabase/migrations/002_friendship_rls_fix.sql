-- Tighten friendship INSERT policy: requester cannot self-approve by setting status = 'accepted'
-- The only valid insert status is 'pending'; acceptance is always via the addressee's UPDATE path.

drop policy if exists "Users can request friendship" on public.friendships;

create policy "Users can request friendship"
  on public.friendships for insert
  with check (auth.uid() = requester_id AND status = 'pending');

-- Also add delete policy so users can unfollow (delete their own outbound row)
create policy "Requester can delete their own friendship row"
  on public.friendships for delete
  using (auth.uid() = requester_id);

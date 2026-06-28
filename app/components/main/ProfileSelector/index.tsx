"use client"

import { ChevronDown, Plus, UserRound } from "lucide-react"
import { Profile } from "../types"
import styles from "./index.module.scss"

type ProfileSelectorProps = {
  profiles: Profile[]
  activeProfile?: Profile
  activeId: string
  open: boolean
  newName: string
  onToggle: () => void
  onSelect: (id: string) => void
  onNewNameChange: (value: string) => void
  onCreate: () => void
}

export function ProfileSelector(props: ProfileSelectorProps) {
  return (
    <div className={styles.root}>
      <button type='button' className={styles.trigger} onClick={props.onToggle}>
        <UserRound size={17} />
        <span>{props.activeProfile?.name || "Profile"}</span>
        <ChevronDown size={16} />
      </button>
      {props.open && (
        <div className={styles.menu}>
          {props.profiles.map((profile) => (
            <button
              type='button'
              className={profile.id === props.activeId ? styles.active : ""}
              key={profile.id}
              onClick={() => props.onSelect(profile.id)}
            >
              {profile.name}
            </button>
          ))}
          <div className={styles.create}>
            <input
              value={props.newName}
              onChange={(event) => props.onNewNameChange(event.target.value)}
              placeholder='New profile'
            />
            <button
              type='button'
              aria-label='Create profile'
              onClick={props.onCreate}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { memo } from 'react'
import { cn } from '@/lib/utils'

// Import flags directly - Vite will bundle these as assets
import usFlag from 'circle-flags/flags/us.svg'
import vnFlag from 'circle-flags/flags/vn.svg'
import jpFlag from 'circle-flags/flags/jp.svg'
import krFlag from 'circle-flags/flags/kr.svg'
import cnFlag from 'circle-flags/flags/cn.svg'
import twFlag from 'circle-flags/flags/tw.svg'
import deFlag from 'circle-flags/flags/de.svg'
import frFlag from 'circle-flags/flags/fr.svg'
import esFlag from 'circle-flags/flags/es.svg'
import brFlag from 'circle-flags/flags/br.svg'
import itFlag from 'circle-flags/flags/it.svg'
import nlFlag from 'circle-flags/flags/nl.svg'
import saFlag from 'circle-flags/flags/sa.svg'
import inFlag from 'circle-flags/flags/in.svg'
import trFlag from 'circle-flags/flags/tr.svg'
import plFlag from 'circle-flags/flags/pl.svg'
import thFlag from 'circle-flags/flags/th.svg'
import idFlag from 'circle-flags/flags/id.svg'
import ruFlag from 'circle-flags/flags/ru.svg'
import myFlag from 'circle-flags/flags/my.svg'
import uaFlag from 'circle-flags/flags/ua.svg'
import czFlag from 'circle-flags/flags/cz.svg'
import seFlag from 'circle-flags/flags/se.svg'
import dkFlag from 'circle-flags/flags/dk.svg'
import fiFlag from 'circle-flags/flags/fi.svg'
import noFlag from 'circle-flags/flags/no.svg'
import grFlag from 'circle-flags/flags/gr.svg'
import ilFlag from 'circle-flags/flags/il.svg'
import roFlag from 'circle-flags/flags/ro.svg'
import huFlag from 'circle-flags/flags/hu.svg'

// Map country codes to imported SVGs
const flagMap: Record<string, string> = {
  us: usFlag,
  vn: vnFlag,
  jp: jpFlag,
  kr: krFlag,
  cn: cnFlag,
  tw: twFlag,
  de: deFlag,
  fr: frFlag,
  es: esFlag,
  br: brFlag,
  it: itFlag,
  nl: nlFlag,
  sa: saFlag,
  in: inFlag,
  tr: trFlag,
  pl: plFlag,
  th: thFlag,
  id: idFlag,
  ru: ruFlag,
  my: myFlag,
  ua: uaFlag,
  cz: czFlag,
  se: seFlag,
  dk: dkFlag,
  fi: fiFlag,
  no: noFlag,
  gr: grFlag,
  il: ilFlag,
  ro: roFlag,
  hu: huFlag,
}

interface CircleFlagProps {
  countryCode: string
  size?: number
  className?: string
}

export const CircleFlag = memo(function CircleFlag({ 
  countryCode, 
  size = 24,
  className 
}: CircleFlagProps) {
  const flagSrc = flagMap[countryCode.toLowerCase()] || flagMap.us
  
  return (
    <img
      src={flagSrc}
      alt={`${countryCode} flag`}
      width={size}
      height={size}
      className={cn(
        "rounded-full ring-2 ring-neutral-200 dark:ring-neutral-600",
        className
      )}
      loading="eager"
      decoding="async"
    />
  )
})

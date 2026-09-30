'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

// ─── IPC suisse — indice officiel OFS (base décembre 2020 = 100) ─────────────
// Source : OFS/BFS — https://www.bfs.admin.ch/bfs/fr/home/statistiques/prix/enquetes/lik.html
// Données depuis janvier 1982. Colonnes OFS converties en base déc. 2020 = 100.
//
// ➕ MISE À JOUR MENSUELLE : ajouter la valeur officielle publiée par l'OFS :
//    '2026-09': 109.3,
const CPI_MONTHLY: Record<string, number> = {
  // 1982
  '1982-01': 60.3,
  '1982-02': 60.4,
  '1982-03': 60.5,
  '1982-04': 60.8,
  '1982-05': 61.6,
  '1982-06': 62.2,
  '1982-07': 62.4,
  '1982-08': 62.9,
  '1982-09': 63.1,
  '1982-10': 63.3,
  '1982-11': 63.5,
  '1982-12': 63.3,

  // 1983
  '1983-01': 63.2,
  '1983-02': 63.3,
  '1983-03': 63.4,
  '1983-04': 63.6,
  '1983-05': 63.6,
  '1983-06': 63.9,
  '1983-07': 63.8,
  '1983-08': 63.9,
  '1983-09': 64.0,
  '1983-10': 64.1,
  '1983-11': 64.6,
  '1983-12': 64.6,

  // 1984
  '1984-01': 64.8,
  '1984-02': 65.1,
  '1984-03': 65.5,
  '1984-04': 65.6,
  '1984-05': 65.5,
  '1984-06': 65.7,
  '1984-07': 65.5,
  '1984-08': 65.8,
  '1984-09': 65.7,
  '1984-10': 66.2,
  '1984-11': 66.5,
  '1984-12': 66.5,

  // 1985
  '1985-01': 67.1,
  '1985-02': 67.7,
  '1985-03': 68.1,
  '1985-04': 68.0,
  '1985-05': 67.9,
  '1985-06': 67.9,
  '1985-07': 67.7,
  '1985-08': 67.7,
  '1985-09': 67.9,
  '1985-10': 68.1,
  '1985-11': 68.6,
  '1985-12': 68.6,

  // 1986
  '1986-01': 68.6,
  '1986-02': 68.6,
  '1986-03': 68.7,
  '1986-04': 68.6,
  '1986-05': 68.4,
  '1986-06': 68.4,
  '1986-07': 68.1,
  '1986-08': 68.2,
  '1986-09': 68.3,
  '1986-10': 68.4,
  '1986-11': 68.5,
  '1986-12': 68.6,

  // 1987
  '1987-01': 69.1,
  '1987-02': 69.3,
  '1987-03': 69.4,
  '1987-04': 69.4,
  '1987-05': 69.1,
  '1987-06': 69.3,
  '1987-07': 69.3,
  '1987-08': 69.6,
  '1987-09': 69.4,
  '1987-10': 69.7,
  '1987-11': 70.0,
  '1987-12': 70.0,

  // 1988
  '1988-01': 70.1,
  '1988-02': 70.5,
  '1988-03': 70.7,
  '1988-04': 70.8,
  '1988-05': 70.6,
  '1988-06': 70.7,
  '1988-07': 70.5,
  '1988-08': 70.8,
  '1988-09': 70.8,
  '1988-10': 70.9,
  '1988-11': 71.2,
  '1988-12': 71.3,

  // 1989
  '1989-01': 71.7,
  '1989-02': 72.0,
  '1989-03': 72.2,
  '1989-04': 72.6,
  '1989-05': 72.7,
  '1989-06': 72.8,
  '1989-07': 72.7,
  '1989-08': 72.9,
  '1989-09': 73.2,
  '1989-10': 73.5,
  '1989-11': 74.4,
  '1989-12': 74.9,

  // 1990
  '1990-01': 75.3,
  '1990-02': 75.6,
  '1990-03': 75.8,
  '1990-04': 76.0,
  '1990-05': 76.3,
  '1990-06': 76.5,
  '1990-07': 76.5,
  '1990-08': 77.4,
  '1990-09': 77.7,
  '1990-10': 78.2,
  '1990-11': 78.9,
  '1990-12': 78.9,

  // 1991
  '1991-01': 79.5,
  '1991-02': 80.3,
  '1991-03': 80.3,
  '1991-04': 80.5,
  '1991-05': 81.2,
  '1991-06': 81.5,
  '1991-07': 81.5,
  '1991-08': 82.0,
  '1991-09': 82.1,
  '1991-10': 82.2,
  '1991-11': 83.2,
  '1991-12': 83.0,

  // 1992
  '1992-01': 83.4,
  '1992-02': 83.9,
  '1992-03': 84.2,
  '1992-04': 84.3,
  '1992-05': 84.6,
  '1992-06': 84.9,
  '1992-07': 84.6,
  '1992-08': 84.9,
  '1992-09': 84.9,
  '1992-10': 85.1,
  '1992-11': 85.9,
  '1992-12': 85.8,

  // 1993
  '1993-01': 86.3,
  '1993-02': 86.8,
  '1993-03': 87.3,
  '1993-04': 87.5,
  '1993-05': 87.6,
  '1993-06': 87.5,
  '1993-07': 87.5,
  '1993-08': 87.9,
  '1993-09': 87.9,
  '1993-10': 87.9,
  '1993-11': 87.9,
  '1993-12': 87.9,

  // 1994
  '1994-01': 88.0,
  '1994-02': 88.4,
  '1994-03': 88.4,
  '1994-04': 88.4,
  '1994-05': 87.9,
  '1994-06': 88.0,
  '1994-07': 88.0,
  '1994-08': 88.4,
  '1994-09': 88.4,
  '1994-10': 88.4,
  '1994-11': 88.3,
  '1994-12': 88.3,

  // 1995
  '1995-01': 88.9,
  '1995-02': 89.8,
  '1995-03': 89.8,
  '1995-04': 89.9,
  '1995-05': 89.7,
  '1995-06': 89.9,
  '1995-07': 89.8,
  '1995-08': 90.1,
  '1995-09': 90.2,
  '1995-10': 90.1,
  '1995-11': 90.0,
  '1995-12': 90.0,

  // 1996
  '1996-01': 90.3,
  '1996-02': 90.4,
  '1996-03': 90.6,
  '1996-04': 90.7,
  '1996-05': 90.3,
  '1996-06': 90.5,
  '1996-07': 90.4,
  '1996-08': 90.6,
  '1996-09': 90.7,
  '1996-10': 90.8,
  '1996-11': 90.6,
  '1996-12': 90.7,

  // 1997
  '1997-01': 91.0,
  '1997-02': 91.2,
  '1997-03': 91.1,
  '1997-04': 91.1,
  '1997-05': 90.9,
  '1997-06': 91.0,
  '1997-07': 90.9,
  '1997-08': 91.1,
  '1997-09': 91.1,
  '1997-10': 91.1,
  '1997-11': 91.0,
  '1997-12': 91.1,

  // 1998
  '1998-01': 91.1,
  '1998-02': 91.1,
  '1998-03': 91.1,
  '1998-04': 91.1,
  '1998-05': 91.0,
  '1998-06': 91.1,
  '1998-07': 91.0,
  '1998-08': 91.2,
  '1998-09': 91.1,
  '1998-10': 91.1,
  '1998-11': 91.0,
  '1998-12': 91.0,

  // 1999
  '1999-01': 91.1,
  '1999-02': 91.4,
  '1999-03': 91.5,
  '1999-04': 91.7,
  '1999-05': 91.5,
  '1999-06': 91.6,
  '1999-07': 91.6,
  '1999-08': 92.0,
  '1999-09': 92.2,
  '1999-10': 92.2,
  '1999-11': 92.2,
  '1999-12': 92.5,

  // 2000
  '2000-01': 92.5,
  '2000-02': 92.9,
  '2000-03': 92.9,
  '2000-04': 93.0,
  '2000-05': 92.9,
  '2000-06': 93.2,
  '2000-07': 93.4,
  '2000-08': 93.1,
  '2000-09': 93.5,
  '2000-10': 93.4,
  '2000-11': 93.9,
  '2000-12': 93.8,

  // 2001
  '2001-01': 93.7,
  '2001-02': 93.6,
  '2001-03': 93.8,
  '2001-04': 94.1,
  '2001-05': 94.6,
  '2001-06': 94.8,
  '2001-07': 94.6,
  '2001-08': 94.1,
  '2001-09': 94.2,
  '2001-10': 94.1,
  '2001-11': 94.2,
  '2001-12': 94.1,

  // 2002
  '2002-01': 94.2,
  '2002-02': 94.2,
  '2002-03': 94.2,
  '2002-04': 95.1,
  '2002-05': 95.2,
  '2002-06': 95.1,
  '2002-07': 94.6,
  '2002-08': 94.5,
  '2002-09': 94.6,
  '2002-10': 95.2,
  '2002-11': 95.0,
  '2002-12': 95.0,

  // 2003
  '2003-01': 95.1,
  '2003-02': 95.1,
  '2003-03': 95.5,
  '2003-04': 95.7,
  '2003-05': 95.6,
  '2003-06': 95.6,
  '2003-07': 94.8,
  '2003-08': 95.0,
  '2003-09': 95.1,
  '2003-10': 95.6,
  '2003-11': 95.5,
  '2003-12': 95.5,

  // 2004
  '2004-01': 95.2,
  '2004-02': 95.3,
  '2004-03': 95.4,
  '2004-04': 96.2,
  '2004-05': 96.5,
  '2004-06': 96.6,
  '2004-07': 95.6,
  '2004-08': 96.0,
  '2004-09': 96.0,
  '2004-10': 96.9,
  '2004-11': 97.0,
  '2004-12': 96.8,

  // 2005
  '2005-01': 96.3,
  '2005-02': 96.6,
  '2005-03': 96.8,
  '2005-04': 97.6,
  '2005-05': 97.5,
  '2005-06': 97.3,
  '2005-07': 96.8,
  '2005-08': 96.9,
  '2005-09': 97.3,
  '2005-10': 98.2,
  '2005-11': 97.9,
  '2005-12': 97.8,

  // 2006
  '2006-01': 97.6,
  '2006-02': 97.9,
  '2006-03': 97.8,
  '2006-04': 98.6,
  '2006-05': 98.9,
  '2006-06': 98.8,
  '2006-07': 98.1,
  '2006-08': 98.3,
  '2006-09': 98.1,
  '2006-10': 98.4,
  '2006-11': 98.4,
  '2006-12': 98.4,

  // 2007
  '2007-01': 97.7,
  '2007-02': 97.9,
  '2007-03': 98.0,
  '2007-04': 99.1,
  '2007-05': 99.3,
  '2007-06': 99.4,
  '2007-07': 98.9,
  '2007-08': 98.7,
  '2007-09': 98.8,
  '2007-10': 99.7,
  '2007-11': 100.1,
  '2007-12': 100.4,

  // 2008
  '2008-01': 100.1,
  '2008-02': 100.2,
  '2008-03': 100.6,
  '2008-04': 101.3,
  '2008-05': 102.2,
  '2008-06': 102.3,
  '2008-07': 101.9,
  '2008-08': 101.6,
  '2008-09': 101.7,
  '2008-10': 102.3,
  '2008-11': 101.6,
  '2008-12': 101.1,

  // 2009
  '2009-01': 100.2,
  '2009-02': 100.4,
  '2009-03': 100.1,
  '2009-04': 101.0,
  '2009-05': 101.1,
  '2009-06': 101.3,
  '2009-07': 100.7,
  '2009-08': 100.8,
  '2009-09': 100.8,
  '2009-10': 101.4,
  '2009-11': 101.6,
  '2009-12': 101.3,

  // 2010
  '2010-01': 101.3,
  '2010-02': 101.4,
  '2010-03': 101.5,
  '2010-04': 102.4,
  '2010-05': 102.3,
  '2010-06': 101.8,
  '2010-07': 101.1,
  '2010-08': 101.1,
  '2010-09': 101.1,
  '2010-10': 101.6,
  '2010-11': 101.8,
  '2010-12': 101.9,

  // 2011
  '2011-01': 101.5,
  '2011-02': 101.9,
  '2011-03': 102.5,
  '2011-04': 102.7,
  '2011-05': 102.7,
  '2011-06': 102.4,
  '2011-07': 101.6,
  '2011-08': 101.3,
  '2011-09': 101.6,
  '2011-10': 101.5,
  '2011-11': 101.3,
  '2011-12': 101.1,

  // 2012
  '2012-01': 100.7,
  '2012-02': 101.0,
  '2012-03': 101.6,
  '2012-04': 101.6,
  '2012-05': 101.6,
  '2012-06': 101.3,
  '2012-07': 100.8,
  '2012-08': 100.8,
  '2012-09': 101.1,
  '2012-10': 101.3,
  '2012-11': 100.9,
  '2012-12': 100.7,

  // 2013
  '2013-01': 100.4,
  '2013-02': 100.8,
  '2013-03': 100.9,
  '2013-04': 101.0,
  '2013-05': 101.1,
  '2013-06': 101.2,
  '2013-07': 100.8,
  '2013-08': 100.8,
  '2013-09': 101.1,
  '2013-10': 101.0,
  '2013-11': 101.0,
  '2013-12': 100.8,

  // 2014
  '2014-01': 100.5,
  '2014-02': 100.6,
  '2014-03': 100.9,
  '2014-04': 101.0,
  '2014-05': 101.3,
  '2014-06': 101.3,
  '2014-07': 100.9,
  '2014-08': 100.8,
  '2014-09': 101.0,
  '2014-10': 101.0,
  '2014-11': 100.9,
  '2014-12': 100.4,

  // 2015
  '2015-01': 100.0,
  '2015-02': 99.7,
  '2015-03': 100.1,
  '2015-04': 99.9,
  '2015-05': 100.1,
  '2015-06': 100.2,
  '2015-07': 99.6,
  '2015-08': 99.4,
  '2015-09': 99.6,
  '2015-10': 99.6,
  '2015-11': 99.6,
  '2015-12': 99.1,

  // 2016
  '2016-01': 98.7,
  '2016-02': 98.9,
  '2016-03': 99.2,
  '2016-04': 99.6,
  '2016-05': 99.7,
  '2016-06': 99.8,
  '2016-07': 99.4,
  '2016-08': 99.3,
  '2016-09': 99.4,
  '2016-10': 99.4,
  '2016-11': 99.2,
  '2016-12': 99.1,

  // 2017
  '2017-01': 99.1,
  '2017-02': 99.6,
  '2017-03': 99.8,
  '2017-04': 100.0,
  '2017-05': 100.2,
  '2017-06': 100.0,
  '2017-07': 99.7,
  '2017-08': 99.7,
  '2017-09': 100.0,
  '2017-10': 100.1,
  '2017-11': 100.0,
  '2017-12': 99.9,

  // 2018
  '2018-01': 99.8,
  '2018-02': 100.2,
  '2018-03': 100.6,
  '2018-04': 100.8,
  '2018-05': 101.2,
  '2018-06': 101.2,
  '2018-07': 100.9,
  '2018-08': 100.9,
  '2018-09': 101.0,
  '2018-10': 101.1,
  '2018-11': 100.9,
  '2018-12': 100.6,

  // 2019
  '2019-01': 100.4,
  '2019-02': 100.8,
  '2019-03': 101.3,
  '2019-04': 101.5,
  '2019-05': 101.8,
  '2019-06': 101.8,
  '2019-07': 101.3,
  '2019-08': 101.3,
  '2019-09': 101.1,
  '2019-10': 100.9,
  '2019-11': 100.8,
  '2019-12': 100.8,

  // 2020
  '2020-01': 100.6,
  '2020-02': 100.7,
  '2020-03': 100.8,
  '2020-04': 100.4,
  '2020-05': 100.4,
  '2020-06': 100.5,
  '2020-07': 100.3,
  '2020-08': 100.4,
  '2020-09': 100.3,
  '2020-10': 100.3,
  '2020-11': 100.1,
  '2020-12': 100.0,

  // 2021
  '2021-01': 100.1,
  '2021-02': 100.2,
  '2021-03': 100.6,
  '2021-04': 100.8,
  '2021-05': 101.0,
  '2021-06': 101.1,
  '2021-07': 101.0,
  '2021-08': 101.3,
  '2021-09': 101.3,
  '2021-10': 101.6,
  '2021-11': 101.6,
  '2021-12': 101.5,

  // 2022
  '2022-01': 101.7,
  '2022-02': 102.4,
  '2022-03': 103.0,
  '2022-04': 103.3,
  '2022-05': 104.0,
  '2022-06': 104.5,
  '2022-07': 104.5,
  '2022-08': 104.8,
  '2022-09': 104.6,
  '2022-10': 104.6,
  '2022-11': 104.6,
  '2022-12': 104.4,

  // 2023
  '2023-01': 105.0,
  '2023-02': 105.8,
  '2023-03': 106.0,
  '2023-04': 106.0,
  '2023-05': 106.3,
  '2023-06': 106.3,
  '2023-07': 106.2,
  '2023-08': 106.4,
  '2023-09': 106.3,
  '2023-10': 106.4,
  '2023-11': 106.2,
  '2023-12': 106.2,

  // 2024
  '2024-01': 106.4,
  '2024-02': 107.1,
  '2024-03': 107.1,
  '2024-04': 107.4,
  '2024-05': 107.7,
  '2024-06': 107.7,
  '2024-07': 107.5,
  '2024-08': 107.5,
  '2024-09': 107.2,
  '2024-10': 107.1,
  '2024-11': 106.9,
  '2024-12': 106.9,

  // 2025
  '2025-01': 106.8,
  '2025-02': 107.4,
  '2025-03': 107.5,
  '2025-04': 107.5,
  '2025-05': 107.6,
  '2025-06': 107.8,
  '2025-07': 107.8,
  '2025-08': 107.7,
  '2025-09': 107.5,
  '2025-10': 107.2,
  '2025-11': 107.0,
  '2025-12': 106.9,

  // 2026
  '2026-01': 106.9,
  '2026-02': 107.6,
  '2026-03': 107.8,
  '2026-04': 108.1,
  '2026-05': 108.3,
  '2026-06': 108.3,
  '2026-07': 108.2,
  '2026-08': 108.6,
}

// Première/dernière clé connue (pour le fallback hors-plage)
const _CPI_FIRST = '1982-01'
const _CPI_LAST  = '2026-08'

function cpiAt(dateStr: string): number {
  const d  = new Date(dateStr)
  const y  = d.getFullYear()
  const mo = d.getMonth()  // 0-indexed
  const key  = `${y}-${String(mo + 1).padStart(2, '0')}`
  const keyN = mo === 11 ? `${y + 1}-01` : `${y}-${String(mo + 2).padStart(2, '0')}`
  const v0 = CPI_MONTHLY[key]
  if (v0 === undefined) return key < _CPI_FIRST ? CPI_MONTHLY[_CPI_FIRST]! : CPI_MONTHLY[_CPI_LAST]!
  const v1 = CPI_MONTHLY[keyN] ?? v0
  const days = new Date(y, mo + 1, 0).getDate()
  return v0 + ((d.getDate() - 1) / days) * (v1 - v0)
}
/** Vrai si la date est dans la plage de données IPC connues */
function cpiDateKnown(dateStr: string): boolean {
  const d = new Date(dateStr)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return key <= _CPI_LAST
}
function inflationCumulee(dateAchat: string): number {
  return cpiAt(new Date().toISOString().slice(0, 10)) / cpiAt(dateAchat) - 1
}

// ─── Date helpers (format européen) ─────────────────────────────────────────
function fmtDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
}
function fmtMonth(iso: string): string {
  // YYYY-MM or YYYY-MM-DD → MM/YYYY
  return iso.slice(5, 7) + '/' + iso.slice(0, 4)
}
function fmtDay(iso: string): string {
  // YYYY-MM-DD → DD/MM
  return iso.slice(8, 10) + '/' + iso.slice(5, 7)
}
function fmtTime(iso: string): string {
  // "YYYY-MM-DD HH:mm:ss" → "14h35"
  return iso.slice(11, 13) + 'h' + iso.slice(14, 16)
}
function fmtHourDay(iso: string): string {
  // "YYYY-MM-DD HH:mm:ss" → "DD/MM HHh"
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + ' ' + iso.slice(11, 13) + 'h'
}
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
function fmtHourDayFull(iso: string): string {
  // "YYYY-MM-DD HH:mm:ss" → "8h, 3 septembre"
  const h = parseInt(iso.slice(11, 13), 10)
  const day = parseInt(iso.slice(8, 10), 10)
  const month = parseInt(iso.slice(5, 7), 10) - 1
  return `${h}h, ${day} ${MOIS_FR[month]}`
}
function fmtDayMonth(iso: string): string {
  // "YYYY-MM-DD" → "3 septembre"
  const day = parseInt(iso.slice(8, 10), 10)
  const month = parseInt(iso.slice(5, 7), 10) - 1
  return `${day} ${MOIS_FR[month]}`
}
function fmtDayMonthYear(iso: string): string {
  // "YYYY-MM-DD" → "3 septembre 2026"
  const day = parseInt(iso.slice(8, 10), 10)
  const month = parseInt(iso.slice(5, 7), 10) - 1
  const year = iso.slice(0, 4)
  return `${day} ${MOIS_FR[month]} ${year}`
}

// ─── Shared price cache ──────────────────────────────────────────────────────
const priceCache = new Map<string, { price: number; fxRate: number }>()

// Cache par ticker (clé = "TICKER:interval") — permet à des ensembles de tickers
// différents de partager les données déjà fetchées et réduit les appels simultanés.
type HistEntry = { dates: string[]; closes: number[] }
const tickerHistCache = new Map<string, HistEntry>()
const tickerHistInProgress = new Map<string, Promise<void>>()

// Cherche la première date connue d'un ticker dans le cache existant (évite un fetch supplémentaire)
function getMinDateFromCache(ticker: string): string | undefined {
  const entry = tickerHistCache.get(ticker.toUpperCase() + ':1day')
  if (entry?.dates && entry.dates.length > 0) return entry.dates[0]
  return undefined
}

async function fetchHistory(tickers: string, bust = false, interval: '1day' | '1h' | '4h' | '5min' = '1day'): Promise<Record<string, HistEntry>> {
  const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)

  // bust : invalide le cache pour ces tickers
  if (bust) {
    for (const t of tickerList) tickerHistCache.delete(t + ':' + interval)
  }

  // Partitionne de façon synchrone : déjà en cache / en cours / à fetcher
  const needFetch: string[] = []
  const waitFor: Promise<void>[] = []
  for (const t of tickerList) {
    const ck = t + ':' + interval
    if (tickerHistCache.has(ck)) continue
    if (tickerHistInProgress.has(ck)) { waitFor.push(tickerHistInProgress.get(ck)!); continue }
    needFetch.push(t)
  }

  // Lance un seul appel batch pour les tickers manquants et l'enregistre AVANT d'await
  // → les appels concurrents voient immédiatement l'entrée en-cours et ne dupliquent pas
  if (needFetch.length > 0) {
    const batchPromise = (async () => {
      try {
        const url = `/api/history?tickers=${encodeURIComponent(needFetch.join(','))}&interval=${interval}`
        const res = await fetch(url)
        if (res.ok) {
          const data: Record<string, HistEntry> = await res.json()
          for (const t of needFetch) {
            tickerHistCache.set(t + ':' + interval, data[t] ?? { dates: [], closes: [] })
          }
        }
      } finally {
        for (const t of needFetch) tickerHistInProgress.delete(t + ':' + interval)
      }
    })()
    for (const t of needFetch) tickerHistInProgress.set(t + ':' + interval, batchPromise)
    waitFor.push(batchPromise)
  }

  if (waitFor.length > 0) await Promise.all(waitFor)

  // Assemble le résultat depuis le cache par ticker
  const result: Record<string, HistEntry> = {}
  for (const t of tickerList) {
    const entry = tickerHistCache.get(t + ':' + interval)
    if (entry) result[t] = entry
  }
  return result
}

const priceFetchInProgress = new Map<string, Promise<{ price: number; fxRate: number } | null>>()
async function fetchPriceCached(ticker: string, devise: string, date?: string): Promise<{ price: number; fxRate: number } | null> {
  const key = `${ticker}|${devise}|${date ?? 'now'}`
  if (priceCache.has(key)) return priceCache.get(key)!
  if (priceFetchInProgress.has(key)) return priceFetchInProgress.get(key)!
  const promise = (async () => {
    try {
      const url = date
        ? `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}&date=${date}`
        : `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}`
      const res = await fetch(url)
      if (!res.ok) return null
      const d = await res.json()
      if (d.price == null) return null
      const entry = { price: d.price, fxRate: d.fxRate ?? 1 }
      priceCache.set(key, entry)
      return entry
    } catch { return null } finally { priceFetchInProgress.delete(key) }
  })()
  priceFetchInProgress.set(key, promise)
  return promise
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Position {
  id: string; nom: string; ticker: string; categorie: string; devise: string
  quantite: number; prixAchat: number; tauxAchatCHF: number; dateAchat: string
  prixActuel: number; tauxActuelCHF: number; derniereMaj?: string; courtier?: string
  dateVente?: string  // si défini, position fermée à cette date (archivée, invisible dans l'actuel)
  prixVente?: number        // prix de vente effectif lors d'une réduction/clôture
  tauxVenteCHF?: number     // taux de change CHF au moment de la vente
}
interface PositionCalc extends Position {
  coutCHF: number; valeurCHF: number; gainCHF: number; gainPctCHF: number
  gainDevise: number; gainPctDevise: number; impactFX: number; gainReel: number; gainPctReel: number
}
interface SearchResult { ticker: string; nom: string; bourse: string; type: string; devise: string; pays?: string }

function typeIcon(t: string): string {
  switch (t.toLowerCase()) {
    case 'equity': case 'equities': case 'action': return '📈'
    case 'etf': case 'etc': case 'etn':            return '🗂️'
    case 'cryptocurrency': case 'crypto':           return '₿'
    case 'future': case 'futures': case 'commodity': return '⛏️'
    case 'mutualfund': case 'mutual fund': case 'bond': case 'fonds': return '🏛️'
    case 'currency': case 'forex':                  return '💱'
    case 'index': case 'indice':                    return '📊'
    default:                                        return '📊'
  }
}

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  'Actions':           'Rechercher une action… (ex: Apple, AAPL)',
  'ETF':               'Rechercher un ETF… (ex: MSCI World, SPY, VT)',
  'Fonds':             'Rechercher un fonds ou ETF obligataire… (ex: TLT, BND)',
  'Matières premières':'Rechercher une matière première… (ex: Or, XAU/USD)',
  'Crypto':            'Rechercher une crypto… (ex: Bitcoin, BTC/USD)',
  'Forex':             'Rechercher une devise… (ex: EUR/USD, USD/CHF)',
  'Tout':              'Rechercher un actif… (ex: AAPL, BTC/USD, EUR/CHF)',
}

const DEVISES = [
  'CHF', 'USD', 'EUR', 'GBP', 'JPY',
  'AUD', 'CAD', 'CNY', 'HKD', 'SGD',
  'NZD', 'NOK', 'SEK', 'DKK', 'PLN',
  'CZK', 'KRW', 'INR', 'MXN', 'BRL',
  'ZAR', 'TRY',
]
const CATEGORIES = ['Tout', 'Actions', 'ETF', 'Fonds', 'Matières premières', 'Crypto', 'Forex']

// ─── Profils courtiers ────────────────────────────────────────────────────────
interface BrokerProfile {
  emoji: string
  description: string
  types: string[]        // quoteTypes autorisés
  exchKeywords: string[] // mots-clés pour exchDisp (vide = tous)
}
// Mots-clés par région (correspondent aux valeurs exchDisp de Yahoo Finance)
const EXCH_US      = ['NYSE','Nasdaq','NasdaqGS','NasdaqCM','NasdaqGM','AMEX','BATS']
const EXCH_EUROPE  = ['Euronext','XETRA','Frankfurt','London','LSE','Milan','Madrid','Stockholm','Oslo','Helsinki','Copenhagen','Warsaw','Prague','Vienna','Brussels','Amsterdam','Paris','Zurich']
const EXCH_SWISS   = ['Swiss','SIX','BX','Berne']
const EXCH_ASIA    = ['Tokyo','Hong Kong','Shanghai','Seoul','Singapore','Mumbai','Sydney']

const BROKER_PROFILES: Record<string, BrokerProfile> = {
  'Interactive Brokers': {
    emoji: '🏦',
    description: 'Complet : actions, ETF, futures, forex, crypto spot, fonds — 170+ marchés mondiaux',
    types: ['EQUITY','ETF','CRYPTOCURRENCY','FUTURE','MUTUALFUND','CURRENCY'],
    exchKeywords: [], // couverture mondiale, aucun filtre exchange
  },
  'Swissquote': {
    emoji: '🇨🇭',
    description: 'Complet : actions, ETF, futures, forex, crypto spot, fonds — centré SIX + 60 marchés',
    types: ['EQUITY','ETF','CRYPTOCURRENCY','FUTURE','MUTUALFUND','CURRENCY'],
    exchKeywords: [...EXCH_SWISS, ...EXCH_US, ...EXCH_EUROPE, ...EXCH_ASIA],
  },
  'Saxo Bank': {
    emoji: '🔵',
    // Saxo propose des crypto ETPs (type ETF), pas de crypto spot — CRYPTOCURRENCY exclu
    description: 'Actions, ETF, futures, forex, fonds — crypto via ETPs uniquement (pas spot)',
    types: ['EQUITY','ETF','FUTURE','CURRENCY','MUTUALFUND'],
    exchKeywords: [], // large couverture mondiale
  },
  'DEGIRO': {
    emoji: '🟠',
    description: 'Actions, ETF, futures, fonds — marchés US + Europe (pas de crypto ni forex)',
    types: ['EQUITY','ETF','FUTURE','MUTUALFUND'],
    exchKeywords: [...EXCH_US, ...EXCH_EUROPE, ...EXCH_SWISS],
  },
  'Trade Republic': {
    emoji: '⚫',
    description: 'Actions, ETF, obligations, crypto spot — marchés US + Europe (pas de forex ni futures)',
    types: ['EQUITY','ETF','CRYPTOCURRENCY'],
    exchKeywords: [...EXCH_US, ...EXCH_EUROPE, ...EXCH_SWISS],
  },
  'Yuh': {
    emoji: '🟡',
    description: 'Actions, ETF, crypto spot — SIX + principaux marchés (sélection limitée, pas de forex)',
    types: ['EQUITY','ETF','CRYPTOCURRENCY'],
    exchKeywords: [...EXCH_SWISS, ...EXCH_US, ...EXCH_EUROPE],
  },
  'Neon': {
    emoji: '🟢',
    description: 'Actions + ETF uniquement sur BX Swiss / SIX — pas de crypto, forex ni futures',
    types: ['EQUITY','ETF'],
    exchKeywords: [...EXCH_SWISS],
  },
}
const BROKERS = ['', ...Object.keys(BROKER_PROFILES)]

const CATEGORY_SUGGESTIONS: Record<string, { ticker: string; nom: string; bourse: string; type: string; devise: string }[]> = {
  'Actions': [
    { ticker: 'AAPL',  nom: 'Apple',             bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'MSFT',  nom: 'Microsoft',          bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'NVDA',  nom: 'NVIDIA',             bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'GOOGL', nom: 'Alphabet',           bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'AMZN',  nom: 'Amazon',             bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'META',  nom: 'Meta',               bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'TSLA',  nom: 'Tesla',              bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'AVGO',  nom: 'Broadcom',           bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'JPM',   nom: 'JPMorgan Chase',     bourse: 'NYSE',   type: 'equity', devise: 'USD' },
    { ticker: 'V',     nom: 'Visa',               bourse: 'NYSE',   type: 'equity', devise: 'USD' },
    { ticker: 'MA',    nom: 'Mastercard',         bourse: 'NYSE',   type: 'equity', devise: 'USD' },
    { ticker: 'LLY',   nom: 'Eli Lilly',          bourse: 'NYSE',   type: 'equity', devise: 'USD' },
    { ticker: 'ASML',  nom: 'ASML Holding',       bourse: 'NASDAQ', type: 'equity', devise: 'USD' },
    { ticker: 'XOM',   nom: 'ExxonMobil',         bourse: 'NYSE',   type: 'equity', devise: 'USD' },
    { ticker: 'UNH',   nom: 'UnitedHealth',       bourse: 'NYSE',   type: 'equity', devise: 'USD' },
  ],
  'ETF': [
    { ticker: 'SPY',  nom: 'SPDR S&P 500',             bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'QQQ',  nom: 'Invesco Nasdaq 100',        bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'VT',   nom: 'Vanguard Total World',      bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'VTI',  nom: 'Vanguard US Total Market',  bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'VOO',  nom: 'Vanguard S&P 500',          bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'IWM',  nom: 'iShares Russell 2000',      bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'EFA',  nom: 'iShares MSCI EAFE',         bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'VWO',  nom: 'Vanguard Emerging Markets', bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'VXUS', nom: 'Vanguard Total Intl Stock', bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'ARKK', nom: 'ARK Innovation',            bourse: 'NYSE',   type: 'etf', devise: 'USD' },
  ],
  'Fonds': [
    { ticker: 'TLT',  nom: 'iShares 20Y US Treasury',       bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'AGG',  nom: 'iShares US Aggregate Bond',      bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'BND',  nom: 'Vanguard Total Bond Market',     bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'LQD',  nom: 'iShares Investment Grade Corp',  bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'HYG',  nom: 'iShares High Yield Corp Bond',   bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'BNDX', nom: 'Vanguard Total Intl Bond',       bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'EMB',  nom: 'iShares JPM USD EM Bond',        bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'VCIT', nom: 'Vanguard Interm Corp Bond',      bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'SHY',  nom: 'iShares 1-3Y US Treasury',       bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'IEF',  nom: 'iShares 7-10Y US Treasury',      bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
  ],
  'Matières premières': [
    { ticker: 'XAU/USD', nom: 'Or Spot',          bourse: 'Forex', type: 'commodity', devise: 'USD' },
    { ticker: 'XAG/USD', nom: 'Argent Spot',      bourse: 'Forex', type: 'commodity', devise: 'USD' },
    { ticker: 'XPT/USD', nom: 'Platine Spot',     bourse: 'Forex', type: 'commodity', devise: 'USD' },
    { ticker: 'XPD/USD', nom: 'Palladium Spot',   bourse: 'Forex', type: 'commodity', devise: 'USD' },
  ],
  'Crypto': [
    { ticker: 'BTC/USD',  nom: 'Bitcoin',    bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'ETH/USD',  nom: 'Ethereum',   bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'SOL/USD',  nom: 'Solana',     bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'BNB/USD',  nom: 'BNB',        bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'XRP/USD',  nom: 'XRP',        bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'ADA/USD',  nom: 'Cardano',    bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'AVAX/USD', nom: 'Avalanche',  bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'DOGE/USD', nom: 'Dogecoin',   bourse: 'Crypto', type: 'cryptocurrency', devise: 'USD' },
  ],
  'Forex': [
    { ticker: 'EUR/USD', nom: 'Euro / Dollar',                 bourse: 'Forex', type: 'currency', devise: 'USD' },
    { ticker: 'USD/CHF', nom: 'Dollar / Franc suisse',         bourse: 'Forex', type: 'currency', devise: 'CHF' },
    { ticker: 'EUR/CHF', nom: 'Euro / Franc suisse',           bourse: 'Forex', type: 'currency', devise: 'CHF' },
    { ticker: 'GBP/USD', nom: 'Livre sterling / Dollar',       bourse: 'Forex', type: 'currency', devise: 'USD' },
    { ticker: 'GBP/CHF', nom: 'Livre sterling / Franc suisse', bourse: 'Forex', type: 'currency', devise: 'CHF' },
    { ticker: 'USD/JPY', nom: 'Dollar / Yen japonais',         bourse: 'Forex', type: 'currency', devise: 'JPY' },
    { ticker: 'EUR/GBP', nom: 'Euro / Livre sterling',         bourse: 'Forex', type: 'currency', devise: 'GBP' },
    { ticker: 'AUD/USD', nom: 'Dollar australien / Dollar',    bourse: 'Forex', type: 'currency', devise: 'USD' },
  ],
}

// ─── Noms simplifiés pour les actifs connus ──────────────────────────────────
const KNOWN_NAMES: Record<string, string> = {
  // Actions US
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'NVDA': 'NVIDIA', 'GOOGL': 'Alphabet',
  'GOOG': 'Alphabet', 'AMZN': 'Amazon', 'META': 'Meta', 'TSLA': 'Tesla',
  'BRK-B': 'Berkshire Hathaway', 'JPM': 'JPMorgan', 'V': 'Visa', 'MA': 'Mastercard',
  'UNH': 'UnitedHealth', 'JNJ': 'Johnson & Johnson', 'XOM': 'ExxonMobil',
  'WMT': 'Walmart', 'LLY': 'Eli Lilly', 'AVGO': 'Broadcom', 'ASML': 'ASML',
  // Actions CH
  'NESN.SW': 'Nestlé', 'ROG.SW': 'Roche', 'NOVN.SW': 'Novartis',
  'ABBN.SW': 'ABB', 'UBSG.SW': 'UBS', 'ZURN.SW': 'Zurich Insurance',
  'SREN.SW': 'Swiss Re', 'GEBN.SW': 'Geberit', 'LONN.SW': 'Lonza',
  'ALC.SW': 'Alcon', 'GIVN.SW': 'Givaudan', 'SIKA.SW': 'Sika',
  // Actions EU
  'MC.PA': 'LVMH', 'TTE.PA': 'TotalEnergies', 'AIR.PA': 'Airbus',
  'SAN.PA': 'Sanofi', 'BNP.PA': 'BNP Paribas', 'OR.PA': "L'Oréal",
  'SAP.DE': 'SAP', 'SIE.DE': 'Siemens', 'BAYN.DE': 'Bayer',
  'ALV.DE': 'Allianz', 'BMW.DE': 'BMW', 'VOW3.DE': 'Volkswagen',
  'ASML.AS': 'ASML', 'SHELL.AS': 'Shell', 'HEIA.AS': 'Heineken',
  // ETF monde
  'IWDA.L': 'iShares MSCI World', 'CSPX.L': 'iShares S&P 500',
  'VWCE.DE': 'Vanguard All-World', 'EUNL.DE': 'iShares MSCI World',
  'AGGH.L': 'iShares Global Agg Bond', 'IBTE.L': 'iShares EUR Govt Bond',
  'EMIM.L': 'iShares Emerging Markets', 'IUSN.DE': 'iShares MSCI Small Cap',
  'SMIM.SW': 'iShares SMI Mid', 'SMMCHA.SW': 'UBS SMI',
  // ETF US
  'SPY': 'SPDR S&P 500', 'QQQ': 'Invesco Nasdaq 100', 'VT': 'Vanguard Total World',
  'VTI': 'Vanguard US Total Market', 'VOO': 'Vanguard S&P 500',
  'IWM': 'iShares Russell 2000', 'EFA': 'iShares MSCI EAFE',
  'VEA': 'Vanguard Developed Markets', 'VWO': 'Vanguard Emerging Markets',
  // ETF Oblig. (Bond ETFs)
  'TLT': 'iShares 20Y US Treasury', 'AGG': 'iShares US Aggregate Bond',
  'BND': 'Vanguard Total Bond Market', 'LQD': 'iShares Investment Grade Corp',
  'HYG': 'iShares High Yield Corp', 'CSBGC7.SW': 'iShares CHF Corp Bond',
  // Matières premières
  'GLD': 'SPDR Gold', 'SLV': 'iShares Silver', 'SGOL': 'Aberdeen Gold',
  'GC=F': 'Or (Futures)', 'CL=F': 'Pétrole WTI (Futures)',
  'NG=F': 'Gaz naturel (Futures)', 'BZ=F': 'Brent (Futures)',
  // Crypto
  // Crypto — format Twelve Data (BASE/QUOTE)
  'BTC/USD': 'Bitcoin', 'ETH/USD': 'Ethereum', 'BNB/USD': 'BNB',
  'SOL/USD': 'Solana', 'XRP/USD': 'XRP', 'ADA/USD': 'Cardano',
  'DOGE/USD': 'Dogecoin', 'AVAX/USD': 'Avalanche', 'DOT/USD': 'Polkadot',
  'MATIC/USD': 'Polygon', 'LINK/USD': 'Chainlink', 'UNI/USD': 'Uniswap',
  // Crypto — ancien format Yahoo (rétrocompatibilité)
  'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'BNB-USD': 'BNB',
  'SOL-USD': 'Solana', 'XRP-USD': 'XRP', 'ADA-USD': 'Cardano',
  // Monnaies — format Twelve Data
  'USD/CHF': 'USD / CHF', 'EUR/CHF': 'EUR / CHF', 'GBP/CHF': 'GBP / CHF',
  'EUR/USD': 'EUR / USD', 'GBP/USD': 'GBP / USD', 'USD/JPY': 'USD / JPY',
  // Métaux précieux spot — format Twelve Data
  'XAU/USD': 'Or Spot', 'XAG/USD': 'Argent Spot', 'XPT/USD': 'Platine Spot', 'XPD/USD': 'Palladium Spot',
  // Monnaies — ancien format Yahoo (rétrocompatibilité)
  'USDCHF=X': 'USD / CHF', 'EURCHF=X': 'EUR / CHF', 'GBPCHF=X': 'GBP / CHF',
  'EURUSD=X': 'EUR / USD', 'GBPUSD=X': 'GBP / USD', 'USDJPY=X': 'USD / JPY',
}

function simplifyName(nom: string, ticker: string): string {
  if (KNOWN_NAMES[ticker]) return KNOWN_NAMES[ticker]
  return nom
    .replace(/\s+UCITS\s+ETF\s+(USD|EUR|CHF|GBP)?\s*(Acc(umulation)?|Dist(ributing)?|Hedged|Cap)?/gi, '')
    .replace(/\s+(USD|EUR|CHF|GBP)\s+(Acc(umulation)?|Dist(ributing)?|Hedged)/gi, '')
    .replace(/\s+UCITS\s+ETF/gi, '')
    .replace(/\s+Index\s+Fund/gi, '')
    .replace(/\s+ETF\s+Trust/gi, '')
    .replace(/\s+Inc\.?$/i, '')
    .replace(/\s+Corp\.?$/i, '')
    .replace(/\s+S\.A\.$/i, '')
    .replace(/\s+N\.V\.$/i, '')
    .replace(/\s+PLC$/i, '')
    .replace(/\s+\(USD\)|\s+\(EUR\)|\s+\(CHF\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
const CAT_COLOR: Record<string, string> = {
  'Actions':            '#7C3AED',
  'ETF':                '#2563EB',
  'Fonds':              '#6366F1',
  'ETF Oblig.':         '#3B82F6',
  'Crypto':             '#14B8A6',
  'Forex':              '#60A5FA',
  'Monnaies':           '#60A5FA',
  'Matières premières': '#93C5FD',
  'Tout':               '#4B5563',
}
// Set de tickers ETF obligataires connus — utilisé pour retypifier en 'bond' dans tous les contextes
const BOND_ETF_TICKERS = new Set(
  (CATEGORY_SUGGESTIONS['Fonds'] ?? []).map(s => s.ticker)
)
const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Tout', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().slice(0, 10),
  prixActuel: 0, tauxActuelCHF: 1, courtier: '',
}

// ─── Autocomplete ticker ──────────────────────────────────────────────────────
function TickerAutocomplete({
  value, onChange, placeholder, filterTypes, filterExch, categorySuggestions
}: {
  value: { ticker: string; nom: string; devise: string }
  onChange: (r: { ticker: string; nom: string; devise: string; type: string }) => void
  placeholder?: string
  filterTypes?: string[]   // quoteTypes autorisés (undefined = tous, [] = impossible)
  filterExch?: string[]    // mots-clés exchange (vide = tous)
  categorySuggestions?: { ticker: string; nom: string; bourse: string; type: string; devise: string }[]
}) {
  const [query, setQuery] = useState(value.ticker ? `${value.nom} (${value.ticker})` : '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(!!value.ticker)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ferme le dropdown si on clique ailleurs
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        let raw: SearchResult[] = data.results ?? []
        // Retypifier les ETF obligataires connus → type 'bond' pour icône 🏛️ dans tous les contextes
        raw = raw.map(r => BOND_ETF_TICKERS.has(r.ticker) ? { ...r, type: 'bond' } : r)
        // Filtrage par profil courtier
        // r.type est un label affichage Yahoo (ex: "Equity", "ETF", "Cryptocurrency")
        // Mapping types Twelve Data (libellés français/anglais) → types internes broker
        const TYPE_DISPLAY_MAP: Record<string, string> = {
          // Types Twelve Data (via /api/search)
          'action': 'EQUITY', 'etf': 'ETF', 'cryptocurrency': 'CRYPTOCURRENCY',
          'crypto': 'CRYPTOCURRENCY', 'forex': 'CURRENCY', 'currency': 'CURRENCY',
          'commodity': 'COMMODITY', 'indice': 'EQUITY', 'fonds': 'MUTUALFUND', 'etc': 'ETF', 'etn': 'ETF',
          // Anciens types Yahoo (rétrocompatibilité positions existantes)
          'equity': 'EQUITY', 'future': 'FUTURE', 'futures': 'FUTURE',
          'mutual fund': 'MUTUALFUND', 'mutualfund': 'MUTUALFUND', 'bond': 'BOND',
        }
        if (filterTypes !== undefined) {
          if (filterTypes.length === 0) {
            // Combinaison impossible (ex: Saxo + Crypto) → aucun résultat
            raw = []
          } else {
            raw = raw.filter(r => {
              const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
              return filterTypes.includes(mapped)
            })
          }
        }
        if (filterExch && filterExch.length > 0) {
          raw = raw.filter(r => {
            const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
            // Crypto, forex et futures ne sont pas sur une bourse classique → exemptés du filtre exchange
            if (['CRYPTOCURRENCY', 'CURRENCY', 'FUTURE'].includes(mapped)) return true
            return !r.bourse || filterExch.some(kw => r.bourse.toLowerCase().includes(kw.toLowerCase()))
          })
        }
        // Injection des actifs connus qui matchent localement (ticker ou nom)
        const qLow = q.toLowerCase()
        const allSugg = categorySuggestions ?? []
        const localMatches: SearchResult[] = allSugg
          .filter(s =>
            s.ticker.toLowerCase().includes(qLow) ||
            s.nom.toLowerCase().includes(qLow)
          )
          .map(s => ({ ticker: s.ticker, nom: s.nom, devise: s.devise, type: s.type, bourse: s.bourse }))
        // Appliquer les mêmes filtres aux matches locaux
        let filteredLocal = localMatches
        if (filterTypes !== undefined && filterTypes.length > 0) {
          filteredLocal = filteredLocal.filter(r => {
            const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
            return filterTypes.includes(mapped)
          })
        } else if (filterTypes?.length === 0) {
          filteredLocal = []
        }
        // Fusionner : locaux en premier, puis Yahoo (sans doublons)
        // En catégorie "ETF Oblig." : les suggestions sont toutes de type 'bond' (virtuel)
        // → on n'accepte de Yahoo que les tickers connus, retypés en 'bond' pour l'icône 🏛️
        const knownBondTickers = new Set(
          (categorySuggestions ?? []).filter(s => s.type === 'bond').map(s => s.ticker)
        )
        const isBondCategory =
          knownBondTickers.size > 0 &&
          (categorySuggestions ?? []).every(s => s.type === 'bond')

        const localTickers = new Set(filteredLocal.map(r => r.ticker))
        let apiResults = raw.filter(r => !localTickers.has(r.ticker))
        if (isBondCategory) {
          // Restreindre aux tickers obligataires connus + forcer le type 'bond'
          apiResults = apiResults
            .filter(r => knownBondTickers.has(r.ticker))
            .map(r => ({ ...r, type: 'bond' }))
        }
        const merged = [
          ...filteredLocal,
          ...apiResults,
        ]
        setResults(merged)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [filterTypes, filterExch, categorySuggestions])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setSelected(false)
    if (!val) { setResults([]); setOpen(true) }
    else search(val)
  }

  function handleSelect(r: SearchResult) {
    const nom = simplifyName(r.nom, r.ticker)
    setQuery(`${nom} (${r.ticker})`)
    setSelected(true)
    setOpen(false)
    setResults([])
    onChange({ ticker: r.ticker, nom, devise: r.devise, type: r.type })
  }

  function handleClear() {
    setQuery('')
    setSelected(false)
    setResults([])
    onChange({ ticker: '', nom: '', devise: value.devise, type: '' })
  }

  const inputCls = `w-full bg-white dark:bg-[#1E2530] border rounded-sm px-3 py-2 text-sm
    text-[#1B3050] dark:text-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]
    focus:border-transparent placeholder-[#9E9A93] pr-8
    ${selected ? 'border-[#14B8A6]' : 'border-[#DDD9D1] dark:border-[#323B4A]'}`

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className={inputCls}
          placeholder={placeholder ?? 'Rechercher un actif… (ex: Apple, NESN, Bitcoin)'}
          value={query}
          onChange={handleInput}
          onFocus={() => { if (results.length > 0) setOpen(true); else if (!query && categorySuggestions?.length) setOpen(true) }}
        />
        {/* Indicateurs à droite */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <span className="text-[#9E9A93] text-xs animate-spin">⟳</span>
          )}
          {selected && (
            <span className="text-[#14B8A6] text-xs">✓</span>
          )}
          {query && (
            <button type="button" onClick={handleClear} className="text-[#9E9A93] hover:text-[#5C6880] text-sm leading-none ml-0.5">×</button>
          )}
        </div>
      </div>

      {/* Dropdown résultats */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors flex items-center gap-3 border-b border-[#F5F3EF] dark:border-[#2A3240] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC] truncate">{simplifyName(r.nom, r.ticker)}</div>
                <div className="text-xs text-[#9E9A93] flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold text-[#14B8A6]">{r.ticker}</span>
                  {r.bourse && <><span>·</span><span>{r.bourse}</span></>}
                </div>
              </div>
              <span className="text-xs font-mono text-[#9E9A93] flex-shrink-0">{r.devise}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestions par catégorie (quand champ vide) */}
      {open && !query && results.length === 0 && categorySuggestions && categorySuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {categorySuggestions.map(r => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors flex items-center gap-3 border-b border-[#F5F3EF] dark:border-[#2A3240] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC] truncate">{r.nom}</div>
                <div className="text-xs text-[#9E9A93] flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold text-[#14B8A6]">{r.ticker}</span>
                  {r.bourse && <><span>·</span><span>{r.bourse}</span></>}
                </div>
              </div>
              <span className="text-xs font-mono text-[#9E9A93] flex-shrink-0">{r.devise}</span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-lg px-4 py-3 text-sm text-[#9E9A93]">
          <div>Aucun résultat pour "{query}"</div>
          {(filterTypes !== undefined && filterTypes.length === 0) && (
            <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
              ⚠️ Cette plateforme ne propose pas ce type d'actif — changez de catégorie ou de courtier.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Colored area helper ─────────────────────────────────────────────────────
function buildColoredAreas(
  pts: { x: number; val: number; base: number }[],
  pxFn: (t: number) => number,
  pyFn: (v: number) => number
): { gainD: string; lossD: string } {
  const gain: string[] = [], loss: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1]
    const d0 = p0.val - p0.base, d1 = p1.val - p1.base
    const x0 = pxFn(p0.x), x1 = pxFn(p1.x)
    const yv0 = pyFn(p0.val), yv1 = pyFn(p1.val)
    const yb0 = pyFn(p0.base), yb1 = pyFn(p1.base)
    const trap = (ax0: number, av0: number, ab0: number, ax1: number, av1: number, ab1: number) =>
      `M ${ax0} ${ab0} L ${ax0} ${av0} L ${ax1} ${av1} L ${ax1} ${ab1} Z`
    if (d0 >= 0 && d1 >= 0) {
      gain.push(trap(x0, yv0, yb0, x1, yv1, yb1))
    } else if (d0 <= 0 && d1 <= 0) {
      loss.push(trap(x0, yv0, yb0, x1, yv1, yb1))
    } else {
      const t = d0 / (d0 - d1)
      const cx = x0 + t * (x1 - x0)
      const cyv = yv0 + t * (yv1 - yv0)
      const cyb = yb0 + t * (yb1 - yb0)
      if (d0 > 0) {
        gain.push(trap(x0, yv0, yb0, cx, cyv, cyb))
        loss.push(trap(cx, cyv, cyb, x1, yv1, yb1))
      } else {
        loss.push(trap(x0, yv0, yb0, cx, cyv, cyb))
        gain.push(trap(cx, cyv, cyb, x1, yv1, yb1))
      }
    }
  }
  return { gainD: gain.join(' '), lossD: loss.join(' ') }
}

// ─── Shared chart utility ─────────────────────────────────────────────────────
/** Binary-search lookup: returns closing price on or before date d.
 *  Extracted to avoid duplication across EvolChart / PnLChart / DrawdownChart. */
function makeLookupClose(histJson: Record<string, { dates: string[]; closes: number[] }>) {
  return function lookupClose(ticker: string, d: string): number | null {
    const h = histJson[ticker.toUpperCase()]
    if (!h || h.dates.length === 0) return null
    // Forward-fill illimité : si le ticker est dans histJson, on retourne toujours
    // son dernier prix connu, même si les données sont périmées (Yahoo en échec).
    // null seulement si : ticker absent de histJson, ou date demandée avant la première cotation.
    let lo = 0, hi = h.dates.length - 1, best = -1
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (h.dates[mid] <= d) { best = mid; lo = mid + 1 } else hi = mid - 1 }
    return best >= 0 ? h.closes[best] : null
  }
}

// ─── Chart: Evolution ─────────────────────────────────────────────────────────
const EvolChart = React.memo(function EvolChart({ data, showFX, range, interval = '1day', dateFrom, dateTo, bustKey = 0, downsampleEvery = 1, timePeriod }: { data: PositionCalc[]; showFX?: boolean; range?: 'all' | '60d' | 'weekly'; interval?: '1day' | '1h' | '4h' | '5min'; dateFrom?: string; dateTo?: string; bustKey?: number; downsampleEvery?: number; timePeriod?: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max' }) {
  const H = 200, PAD = { t: 10, r: 10, b: 10, l: 10 }

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; cost: number; value: number; valueNoFX: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const showInvesti = true
  const showValeur = true
  const horsFXAllowed = timePeriod !== '1D' && timePeriod !== '1W'
  const [showHorsFX, setShowHorsFX] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverMxEvol, setHoverMxEvol] = useState<number | null>(null)
  const [zoomWEvol, setZoomWEvol] = useState<[number, number]>([0, 1])
  const zoomDragEvol = useRef<{ startX: number; startZoom: [number, number] } | null>(null)
  const _bustLastSeen = useRef(0)
  const [measuredW, setMeasuredW] = useState(0)
  const chartProbeRef = useCallback((node: SVGSVGElement | null) => {
    if (!node) return
    const update = () => setMeasuredW(node.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
  }, [])
  const W = measuredW > 0 ? measuredW : 600
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  // Drawdown calculé sur le PnL nominal (comme PnLChart) — inclut delta lots pour cohérence
  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].filter(p => p.quantite > 0).sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    if (sorted.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const today = new Date()
    const pad2b = (n: number) => String(n).padStart(2, '0')
    if (interval === '5min') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(); start.setHours(0,0,0,0)
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 5*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:${pad2b(d.getMinutes())}:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '1h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 60*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '4h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setMonth(d.getMonth()-1); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 4*60*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (range === '60d') {
      const list: string[] = []
      if (dateFrom && dateTo) {
        let d = new Date(dateFrom)
        const end = new Date(dateTo)
        while (d <= end) { list.push(d.toISOString().slice(0, 10)); d = new Date(d); d.setDate(d.getDate() + 1) }
      } else {
        for (let i = 59; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); list.push(d.toISOString().slice(0, 10)) }
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: (new Date(list[list.length - 1]).getTime() - first.getTime()) || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      // Aligner sur les vraies semaines lundi-dimanche
      // Parser la date en heure locale pour que getDay() retourne le bon jour
      const [fy, fm, fd] = sorted[0].dateAchat.split('-').map(Number)
      const firstLocal = new Date(fy, fm - 1, fd)
      const dow = firstLocal.getDay() // 0=dim, 1=lun, ..., 6=sam
      const daysToMon = dow === 0 ? 6 : dow - 1
      const mondayOfFirstWeek = new Date(firstLocal)
      mondayOfFirstWeek.setDate(firstLocal.getDate() - daysToMon)
      // Partir de la semaine précédente pour que le premier point soit ancré
      const startMonday = new Date(mondayOfFirstWeek)
      startMonday.setDate(mondayOfFirstWeek.getDate() - 7)
      const list: string[] = []
      let d = new Date(startMonday)
      while (d <= today) {
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: startMonday, totalMs: (today.getTime() - startMonday.getTime()) || 1 }
    }
    // Partir du mois précédant le premier achat (même logique que weekly)
    const startMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1)
    const list: string[] = []
    let dYear = startMonth.getFullYear(), dMonth = startMonth.getMonth()
    const todayYM = today.getFullYear() * 12 + today.getMonth()
    while (dYear * 12 + dMonth <= todayYM) {
      list.push(`${dYear}-${String(dMonth + 1).padStart(2, '0')}-01`)
      dMonth++; if (dMonth > 11) { dMonth = 0; dYear++ }
    }
    return { dates: list, firstDate: startMonth, totalMs: (today.getTime() - startMonth.getTime()) || 1 }
  }, [data, range, interval, dateFrom, dateTo])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + (interval ?? '1day') + '|' + (dateFrom ?? '') + '|' + (dateTo ?? '') + '|' + bustKey + '|' + downsampleEvery, [data, range, interval, dateFrom, dateTo, bustKey, downsampleEvery])

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; cost: number; value: number; valueNoFX: number; label: string }[] = []

      // ─── Bulk history (évite N×M appels /api/prices) ──────────────────────
      const allTickers = [...new Set(data.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(data.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeen.current; _bustLastSeen.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust, interval) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        // Mode hebdomadaire : évaluer au dimanche (fin de semaine) pour capturer le
        // vendredi via forward-fill. Placer le point sur le lundi (dateStr) en x/label.
        // Mode mensuel : évaluer au dernier jour du mois (même logique que weekly → dimanche).
        const evalDateStr = range === 'weekly' ? (() => {
          const sun = new Date(dateStr); sun.setDate(sun.getDate() + 6)
          const sunStr = sun.toISOString().slice(0, 10)
          return sunStr <= today ? sunStr : today
        })() : range === 'all' ? (() => {
          const [dy, dm] = dateStr.split('-').map(Number)
          const lastDay = new Date(dy, dm, 0) // dernier jour du mois en heure locale
          const s = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
          return s <= today ? s : today
        })() : dateStr
        const isToday = (interval === '5min' || interval === '1h' || interval === '4h') ? false : evalDateStr >= today
        const activePosns = data.filter(p => p.dateAchat <= evalDateStr)
        if (activePosns.length === 0) { setProgress(Math.round((i + 1) / dates.length * 100)); continue }

        const prices = await Promise.all(activePosns.map(async p => {
          if (!isToday) {
            const price = lookupClose(p.ticker, evalDateStr)
            if (price !== null) {
              const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const fxRate = fxPair ? (lookupClose(fxPair, evalDateStr) ?? p.tauxActuelCHF) : 1
              return { price, fxRate }
            }
            // Pas de prix dans l'hist pour cette date → oldest known (évite tout appel API supplémentaire)
            const h = histJson[p.ticker.toUpperCase()]
            const fxKey = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
            const hFx = fxKey ? histJson[fxKey.toUpperCase()] : null
            return { price: h?.closes[0] ?? p.prixAchat, fxRate: hFx?.closes[0] ?? p.tauxAchatCHF }
          }
          const d = await fetchPriceCached(p.ticker, p.devise, undefined)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        // coût net : Investi diminue de qty_vendue × prixAchat × tauxAchat à la date de clôture
        const cumCost = activePosns.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
        // valeur : quantités signées naturelles — le lot vendu (-500) annule partie du lot long (+1000)
        // → après la clôture le graphique reflète uniquement le nouveau portefeuille restant
        const value = activePosns.reduce((s, p, j) => {
          return s + p.quantite * prices[j].price * prices[j].fxRate
        }, 0)
        const valueNoFX = activePosns.reduce((s, p, j) => {
          return s + p.quantite * prices[j].price * p.tauxAchatCHF
        }, 0)
        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const _spanMs = dateFrom ? (new Date(dateTo ?? today).getTime() - new Date(dateFrom).getTime()) : Infinity
        const label = (interval === '5min') ? fmtTime(dateStr) : (interval === '1h' || interval === '4h') ? fmtHourDayFull(dateStr) : range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : (timePeriod === '1Y' || (timePeriod === 'Max' && _spanMs > 365 * 24 * 3600 * 1000)) ? fmtDayMonthYear(dateStr) : fmtDayMonth(dateStr)
        result.push({ x: isToday ? 1 : t, cost: cumCost, value, valueNoFX, label })
        setProgress(Math.round((i + 1) / dates.length * 100))
      }
      // ─── Point temps réel (valeur actuelle précise via fetchPriceCached) ──────────
      if (!cancelled) {
        const nowActivePosns = data.filter(p => p.dateAchat <= today)
        if (nowActivePosns.length > 0) {
          const nowPrices = await Promise.all(nowActivePosns.map(async p => {
            const d = await fetchPriceCached(p.ticker, p.devise, undefined)
            return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
          }))
          const nowValue = nowActivePosns.reduce((s, p, j) => s + p.quantite * nowPrices[j].price * nowPrices[j].fxRate, 0)
          const nowValueNoFX = nowActivePosns.reduce((s, p, j) => s + p.quantite * nowPrices[j].price * p.tauxAchatCHF, 0)
          const nowCost = nowActivePosns.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
          result.push({ x: 1, cost: nowCost, value: nowValue, valueNoFX: nowValueNoFX, label: 'Actuel' })
        }
      }
      // Normaliser la valeur actuelle pour qu'elle parte du même point que la valeur investie
      // à la première semaine/mois avec des positions
      if ((range === 'all' || range === 'weekly') && result.length > 0) {
        const firstWithCost = result.find(pt => pt.cost > 0)
        if (firstWithCost) {
          const offV = firstWithCost.value - firstWithCost.cost
          const offVNoFX = firstWithCost.valueNoFX - firstWithCost.cost
          for (const pt of result) { pt.value -= offV; pt.valueNoFX -= offVNoFX }
        }
      }
      // YTD/1M/1Y : ancrer la courbe au bord gauche avec la première vraie valeur
      if (interval === '1day' && dateFrom && result.length > 0 && result[0].x > 0.001) {
        result[0].x = 0
      }
      // Pour l'intraday (5min, 1h, 4h), chaque candle est pertinent — pas de déduplication
      // Pour les données journalières+, supprimer les points plats sur les 3 courbes
      const isIntraday = interval === '5min' || interval === '1h' || interval === '4h'
      const deduped = (!isIntraday && result.length > 1)
        ? result.filter((pt, i) => i === 0
            || Math.abs(pt.value      - result[i - 1].value)      > 0.001
            || Math.abs(pt.cost       - result[i - 1].cost)       > 0.001
            || Math.abs(pt.valueNoFX  - result[i - 1].valueNoFX)  > 0.001)
        : result
      // Espacement uniforme entre points (ignore l'écart de temps réel)
      const finalResult = deduped.length > 1
        ? deduped.map((pt, i) => ({ ...pt, x: i / (deduped.length - 1) }))
        : deduped
      const sampledResult = downsampleEvery > 1 ? finalResult.filter((_, i) => i % downsampleEvery === 0 || i === finalResult.length - 1) : finalResult
      if (!cancelled) { setMonthlyPts(sampledResult); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <div className="w-48 h-1.5 bg-[#DDD9D1] dark:bg-[#2a3f52] rounded-full overflow-hidden">
        <div className="h-full bg-[#14B8A6] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-[#9E9A93]">{range === '60d' ? 'Chargement 60 jours…' : range === 'weekly' ? 'Chargement des données hebdomadaires…' : 'Chargement des données mensuelles…'} {progress}%</p>
    </div>
  )

  const points = monthlyPts

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      {range === 'weekly' ? 'Détention trop courte pour la vue hebdomadaire' : range === '60d' ? 'Pas assez de données sur 60 jours' : 'Détention trop courte pour la vue mensuelle'}
    </div>
  )

  const lastVal = points[points.length - 1].value
  const zE = zoomWEvol
  const isZoomedEvol = zE[0] > 0.001 || zE[1] < 0.999
  const visPtsE = points.filter(p => p.x >= zE[0] - 0.001 && p.x <= zE[1] + 0.001)
  const firstVisE = visPtsE[0] ?? points[0]
  const lastVisE = visPtsE[visPtsE.length - 1] ?? points[points.length - 1]
  const scalePtsE = isZoomedEvol && visPtsE.length > 1 ? visPtsE : points
  const allValuesVis = scalePtsE.flatMap(p => [...(showInvesti ? [p.cost] : []), ...(showValeur ? [p.value] : []), ...(showHorsFX ? [p.valueNoFX] : [])]).filter(v => isFinite(v))
  const allValuesFallbackVis = allValuesVis.length ? allValuesVis : scalePtsE.flatMap(p => [p.value])
  const _maxVis = Math.max(...allValuesFallbackVis), _minVis = Math.min(...allValuesFallbackVis)
  const rawSpanVis = (_maxVis - _minVis) || _maxVis * 0.1 || 1
  const rawStepVis = rawSpanVis / 4
  const magVis = Math.pow(10, Math.floor(Math.log10(rawStepVis)))
  const normVis = rawStepVis / magVis
  const niceStepVis = (normVis < 1.5 ? 1 : normVis < 3 ? 2 : normVis < 7 ? 5 : 10) * magVis
  const minVVis = Math.floor(_minVis / niceStepVis) * niceStepVis
  const maxVVis = Math.ceil(_maxVis / niceStepVis) * niceStepVis
  const spanVis = maxVVis - minVVis || 1
  const px = (t: number) => PAD.l + ((t - zE[0]) / (zE[1] - zE[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minVVis) / spanVis) * iH
  const tickVals = Array.from({ length: Math.round((maxVVis - minVVis) / niceStepVis) + 1 }, (_, i) => minVVis + i * niceStepVis)
  const costPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.cost)}`).join(' ')

  const { gainD, lossD } = buildColoredAreas(
    points.map(p => ({ x: p.x, val: p.value, base: p.cost })),
    px, py
  )

  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  const _dispPt = hovered ?? (points ? points[points.length - 1] : null)
  const _dispGain = _dispPt ? _dispPt.value - _dispPt.cost : 0
  const _dispGainPct = _dispPt && _dispPt.cost > 0 ? (_dispGain / _dispPt.cost) * 100 : 0
  const _dispGainNoFX = _dispPt ? _dispPt.valueNoFX - _dispPt.cost : 0
  const _dispGainNoFXPct = _dispPt && _dispPt.cost > 0 ? (_dispGainNoFX / _dispPt.cost) * 100 : 0

  return (
    <>
    {/* ── Stat header + toggle buttons ── */}
    <div className="flex items-start justify-between mb-3 px-5">
      <div className="min-h-[52px]">
        {_dispPt ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tabular-nums text-[#1B3050] dark:text-white">
                {_dispPt.value.toFixed(2)} CHF
              </span>
              <span className={`text-sm font-semibold tabular-nums ${_dispGain >= 0 ? 'text-[#14B8A6]' : 'text-[#EF4444]'}`}>
                {_dispGain >= 0 ? '+' : ''}{_dispGain.toFixed(2)} CHF
                {' '}({_dispGain >= 0 ? '+' : ''}{_dispGainPct.toFixed(2)}%)
              </span>
              {horsFXAllowed && showHorsFX && _dispPt && (
                <span className={`text-sm font-semibold tabular-nums text-[#1B5C80]`}>
                  Hors FX {_dispGainNoFX >= 0 ? '+' : ''}{_dispGainNoFX.toFixed(2)} CHF
                  {_dispPt.cost > 0 && <> ({_dispGainNoFX >= 0 ? '+' : ''}{_dispGainNoFXPct.toFixed(2)}%)</>}
                </span>
              )}
            </div>
            <div className="mt-0.5">
              <span className="text-xs text-[#9E9A93] tabular-nums">Investi&nbsp;{_dispPt.cost.toFixed(2)} CHF</span>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {horsFXAllowed && (
        <button type="button" onClick={() => setShowHorsFX(v => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all ${showHorsFX ? 'border-[#1B5C80] bg-[#F5F3EF] dark:bg-[#1E2530]' : 'border-[#DDD9D1] dark:border-[#323B4A] opacity-40'}`}>
          <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" /></svg>
          <span style={{ color: '#1B5C80' }}>Hors FX</span>
        </button>
        )}
        <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#EDEAE4] dark:bg-[#323B4A] text-[#9E9A93] text-[9px] font-bold cursor-help group/tipEvol">
          ?
          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2.5 py-2 bg-[#EDEAE4] dark:bg-[#323B4A] text-[#4B4945] dark:text-[#C8C4BC] text-[10px] rounded shadow-md opacity-0 group-hover/tipEvol:opacity-100 transition-opacity z-50 leading-relaxed space-y-1.5">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <svg width="20" height="10" className="flex-shrink-0"><line x1="0" y1="5" x2="10" y2="5" stroke="#14B8A6" strokeWidth="2" /><line x1="10" y1="5" x2="20" y2="5" stroke="#EF4444" strokeWidth="2" /></svg>
              <span><span className="font-semibold">Valeur actuelle</span> — valeur totale du portefeuille</span>
            </span>
            {horsFXAllowed && (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <svg width="20" height="10" className="flex-shrink-0"><line x1="0" y1="5" x2="20" y2="5" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
              <span><span className="font-semibold">Hors FX</span> — FX figé au taux d&apos;achat</span>
            </span>
            )}
          </span>
        </span>
      </div>
    </div>
    {isZoomedEvol && (
      <div className="flex justify-end mb-1 px-5">
        <button type="button" onClick={() => setZoomWEvol([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#14B8A6] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#323B4A]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg ref={chartProbeRef} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: H, cursor: isZoomedEvol ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdx(null); setHoverMxEvol(null); zoomDragEvol.current = null }}
      onMouseDown={e => {
        if (!isZoomedEvol) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragEvol.current = { startX: mx, startZoom: [zE[0], zE[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragEvol.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragEvol.current) {
          const delta = (zoomDragEvol.current.startX - mx) / iW * (zE[1] - zE[0])
          const [z0, z1] = zoomDragEvol.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWEvol([newZ0, newZ0 + sp])
          return
        }
        const t = zE[0] + ((mx - PAD.l) / iW) * (zE[1] - zE[0])
        let best = -1, bd = Infinity
        points.forEach((p, i) => {
          if (p.x < zE[0] - 0.001 || p.x > zE[1] + 0.001) return
          const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i }
        })
        if (best < 0) return
        setHoverIdx(best); setHoverMxEvol(px(points[best].x))
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zE[0] + ((mx - PAD.l) / iW) * (zE[1] - zE[0])
        const factor = zE[1] - zE[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zE[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWEvol([newZ0, newZ0 + nf])
      }}
    >
      <defs>
        <clipPath id="eg-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="eg-gain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="eg-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="eg-cost" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C6880" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#5C6880" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath="url(#eg-clip)">
      {showValeur && gainD && <path d={gainD} fill="none" />}
      {showValeur && lossD && <path d={lossD} fill="none" />}
      {horsFXAllowed && showHorsFX && <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.valueNoFX)}`).join(' ')}
          fill="none" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
        />}
      {showInvesti && <path d={costPath} fill="none" stroke="var(--finv-cost-line)" strokeWidth="1" strokeDasharray="6 3" />}
      {showValeur && (() => {
        const R = 4
        const rndPath = (pts: [number,number][]) => {
          if (pts.length < 2) return ''
          if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`
          let d = `M${pts[0][0]},${pts[0][1]}`
          for (let i = 1; i < pts.length - 1; i++) {
            const [ax,ay]=pts[i-1],[bx,by]=pts[i],[cx2,cy2]=pts[i+1]
            const d1=Math.sqrt((bx-ax)**2+(by-ay)**2), d2=Math.sqrt((cx2-bx)**2+(cy2-by)**2)
            const r=Math.min(R,d1/2,d2/2)
            d+=` L${bx-r*(bx-ax)/d1},${by-r*(by-ay)/d1} Q${bx},${by} ${bx+r*(cx2-bx)/d2},${by+r*(cy2-by)/d2}`
          }
          return d+` L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`
        }
        const runs: { color: string; pts: [number,number][] }[] = []
        let curColor = '', curPts: [number,number][] = []
        const flush = () => { if (curPts.length > 1) runs.push({ color: curColor, pts: [...curPts] }); curPts = [] }
        const addSeg = (x1: number, y1: number, x2: number, y2: number, col: string) => {
          if (col !== curColor) { flush(); curColor = col; curPts = [[x1,y1],[x2,y2]] }
          else { if (curPts.length === 0) curPts = [[x1,y1]]; curPts.push([x2,y2]) }
        }
        points.slice(0, -1).forEach((p0, i) => {
          const p1 = points[i + 1]
          const d0 = p0.value - p0.cost, d1 = p1.value - p1.cost
          if (d0 >= 0 && d1 >= 0) {
            addSeg(px(p0.x), py(p0.value), px(p1.x), py(p1.value), '#14B8A6')
          } else if (d0 <= 0 && d1 <= 0) {
            addSeg(px(p0.x), py(p0.value), px(p1.x), py(p1.value), '#EF4444')
          } else {
            const t = d0 / (d0 - d1)
            const cx = px(p0.x) + t * (px(p1.x) - px(p0.x))
            const cy = py(p0.value) + t * (py(p1.value) - py(p0.value))
            addSeg(px(p0.x), py(p0.value), cx, cy, d0 > 0 ? '#14B8A6' : '#EF4444')
            addSeg(cx, cy, px(p1.x), py(p1.value), d0 > 0 ? '#EF4444' : '#14B8A6')
          }
        })
        flush()
        return runs.map((r, i) => <path key={i} d={rndPath(r.pts)} fill="none" stroke={r.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)
      })()}
      </g>
      {hovered && (() => {
        const g = hovered.value - hovered.cost
        const mx = hoverMxEvol ?? px(hovered.x)
        const lx = Math.min(Math.max(mx, PAD.l + 22), W - PAD.r - 22)
        const labelAbove = py(hovered.value) < PAD.t + 28
        const ly = labelAbove ? py(hovered.value) + 20 : py(hovered.value) - 28
        return (
          <g>
            <line x1={mx} y1={PAD.t} x2={mx} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
            {showValeur && <circle cx={px(hovered.x)} cy={py(hovered.value)} r="4" fill={g >= 0 ? '#14B8A6' : '#EF4444'} />}
            <g transform={`translate(${lx}, ${ly})`}>
              {(() => { const lw = Math.round(hovered.label.length * 5.4 + 14); return (<><rect x={-lw/2} y="-9" width={lw} height="18" rx="3" style={{fill:'var(--chart-lbl-bg)'}} opacity="0.95" /><text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="600" style={{fill:'var(--chart-lbl-text)'}}>{hovered.label}</text></>) })()}
            </g>
          </g>
        )
      })()}
      {showValeur && <><circle cx={px(points[points.length-1].x)} cy={py(lastVal)} r="7" fill="none" stroke={lastVal >= points[points.length-1].cost ? '#14B8A6' : '#EF4444'} strokeWidth="1" strokeOpacity="0.35" /><circle cx={px(points[points.length-1].x)} cy={py(lastVal)} r="4" fill={lastVal >= points[points.length-1].cost ? '#14B8A6' : '#EF4444'} /></>}
    </svg>

    </>
  )
})


// ─── Chart: PnL ──────────────────────────────────────────────────────────────
function inflationBetween(dateAchat: string, dateTo: string): number {
  return cpiAt(dateTo) / cpiAt(dateAchat) - 1
}

const PnLChart = React.memo(function PnLChart({ data, range, interval = '1day', dateFrom, dateTo, bustKey = 0, downsampleEvery = 1, timePeriod }: { data: PositionCalc[]; range?: 'all' | '60d' | 'weekly'; interval?: '1day' | '1h' | '4h' | '5min'; dateFrom?: string; dateTo?: string; bustKey?: number; downsampleEvery?: number; timePeriod?: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max' }) {
  const showNominal = true  // toujours actif, pas de toggle
  const [showReel, setShowReel] = useState(false)
  const H = 200, PAD = { t: 10, r: 10, b: 10, l: 10 }

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; nominal: number; reel: number; reelKnown: boolean; nominalNoFX: number; cost: number; label: string }[] | null>(null)
  const [anchorNominal, setAnchorNominal] = useState<number>(0)
  const [anchorReel, setAnchorReel] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hoverIdxPnl, setHoverIdxPnl] = useState<number | null>(null)
  const [hoverMxPnl, setHoverMxPnl] = useState<number | null>(null)
  const [zoomWPnl, setZoomWPnl] = useState<[number, number]>([0, 1])
  const zoomDragPnl = useRef<{ startX: number; startZoom: [number, number] } | null>(null)

  // Drawdown calculé sur le PnL nominal (comme PnLChart) — inclut delta lots pour cohérence
  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].filter(p => p.quantite > 0).sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date()
    const pad2c = (n: number) => String(n).padStart(2, '0')
    if (interval === '5min') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(); start.setHours(0,0,0,0)
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 5*60*1000))
        list.push(`${d.getFullYear()}-${pad2c(d.getMonth()+1)}-${pad2c(d.getDate())} ${pad2c(d.getHours())}:${pad2c(d.getMinutes())}:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '1h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 60*60*1000))
        list.push(`${d.getFullYear()}-${pad2c(d.getMonth()+1)}-${pad2c(d.getDate())} ${pad2c(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '4h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setMonth(d.getMonth()-1); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 4*60*60*1000))
        list.push(`${d.getFullYear()}-${pad2c(d.getMonth()+1)}-${pad2c(d.getDate())} ${pad2c(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (range === '60d') {
      const list: string[] = []
      if (dateFrom && dateTo) {
        let d = new Date(dateFrom)
        const end = new Date(dateTo)
        while (d <= end) { list.push(d.toISOString().slice(0, 10)); d = new Date(d); d.setDate(d.getDate() + 1) }
      } else {
        for (let i = 59; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); list.push(d.toISOString().slice(0, 10)) }
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: (new Date(list[list.length - 1]).getTime() - first.getTime()) || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      // Aligner sur les vraies semaines lundi-dimanche
      // Parser la date en heure locale pour que getDay() retourne le bon jour
      const [fy, fm, fd] = sorted[0].dateAchat.split('-').map(Number)
      const firstLocal = new Date(fy, fm - 1, fd)
      const dow = firstLocal.getDay() // 0=dim, 1=lun, ..., 6=sam
      const daysToMon = dow === 0 ? 6 : dow - 1
      const mondayOfFirstWeek = new Date(firstLocal)
      mondayOfFirstWeek.setDate(firstLocal.getDate() - daysToMon)
      // Partir de la semaine précédente pour que le premier point soit à 0
      const startMonday = new Date(mondayOfFirstWeek)
      startMonday.setDate(mondayOfFirstWeek.getDate() - 7)
      const list: string[] = []
      let d = new Date(startMonday)
      while (d <= today) {
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: startMonday, totalMs: (today.getTime() - startMonday.getTime()) || 1 }
    }
    // Partir du mois précédant le premier achat (même logique que weekly)
    const startMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1)
    const list: string[] = []
    let dYear = startMonth.getFullYear(), dMonth = startMonth.getMonth()
    const todayYM = today.getFullYear() * 12 + today.getMonth()
    while (dYear * 12 + dMonth <= todayYM) {
      list.push(`${dYear}-${String(dMonth + 1).padStart(2, '0')}-01`)
      dMonth++; if (dMonth > 11) { dMonth = 0; dYear++ }
    }
    return { dates: list, firstDate: startMonth, totalMs: (today.getTime() - startMonth.getTime()) || 1 }
  }, [data, range, interval, dateFrom, dateTo])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + (interval ?? '1day') + '|' + (dateFrom ?? '') + '|' + (dateTo ?? '') + '|' + bustKey + '|' + downsampleEvery, [data, range, interval, dateFrom, dateTo, bustKey, downsampleEvery])
  const _bustLastSeenPnL = useRef(0)
  const [measuredW, setMeasuredW] = useState(0)
  const chartProbeRef = useCallback((node: SVGSVGElement | null) => {
    if (!node) return
    const update = () => setMeasuredW(node.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
  }, [])
  const W = measuredW > 0 ? measuredW : 600
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; nominal: number; reel: number; reelKnown: boolean; nominalNoFX: number; cost: number; label: string }[] = []

      // ─── Bulk history (évite N×M appels /api/prices) ──────────────────────
      const allTickers = [...new Set(data.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(data.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeenPnL.current; _bustLastSeenPnL.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust, interval) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)

      // ─── Anchor : PnL une période avant dates[0] ──────────────────────────────
      let anchorNomValue = 0, anchorReelValue = 0, anchorNomNoFXValue = 0
      if (range !== 'all' && range !== 'weekly' && dates.length > 0) {
        const pad2a = (n: number) => String(n).padStart(2, '0')
        const anchorDateStr = (() => {
          const s = dates[0]
          if (interval === '5min') {
            const d = new Date(s.replace(' ', 'T')); d.setMinutes(d.getMinutes() - 5)
            return `${d.getFullYear()}-${pad2a(d.getMonth()+1)}-${pad2a(d.getDate())} ${pad2a(d.getHours())}:${pad2a(d.getMinutes())}:00`
          } else if (interval === '1h') {
            const d = new Date(s.replace(' ', 'T')); d.setHours(d.getHours() - 1)
            return `${d.getFullYear()}-${pad2a(d.getMonth()+1)}-${pad2a(d.getDate())} ${pad2a(d.getHours())}:00:00`
          } else if (interval === '4h') {
            const d = new Date(s.replace(' ', 'T')); d.setHours(d.getHours() - 4)
            return `${d.getFullYear()}-${pad2a(d.getMonth()+1)}-${pad2a(d.getDate())} ${pad2a(d.getHours())}:00:00`
          } else {
            const d = new Date(s); d.setDate(d.getDate() - 1)
            return d.toISOString().slice(0, 10)
          }
        })()
        const ancActivePosns = data.filter(p => p.dateAchat <= anchorDateStr)
        if (ancActivePosns.length > 0) {
          const ancPrices = await Promise.all(ancActivePosns.map(async p => {
            const price = lookupClose(p.ticker, anchorDateStr)
            const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
            const fxRate = fxPair ? (lookupClose(fxPair, anchorDateStr) ?? p.tauxActuelCHF) : 1
            if (price !== null) return { price, fxRate }
            const h = histJson[p.ticker.toUpperCase()]
            const hFx = fxPair ? histJson[fxPair.toUpperCase()] : null
            return { price: h?.closes[0] ?? p.prixAchat, fxRate: hFx?.closes[0] ?? p.tauxAchatCHF }
          }))
          let ancNom = 0, ancReel = 0, ancNomNoFX = 0
          for (let j = 0; j < ancActivePosns.length; j++) {
            const p = ancActivePosns[j]
            const valCHF = p.quantite * ancPrices[j].price * ancPrices[j].fxRate
            const valNoFX = p.quantite * ancPrices[j].price * p.tauxAchatCHF
            if (p.quantite < 0 && p.prixVente != null) {
              ancNom += valCHF + p.valeurCHF
              ancNomNoFX += valNoFX + Math.abs(p.quantite) * p.prixVente * p.tauxAchatCHF
              ancReel += valCHF + p.valeurCHF - p.coutCHF * inflationBetween(p.dateAchat, anchorDateStr)
            } else {
              ancNom += valCHF - p.coutCHF
              ancNomNoFX += valNoFX - p.coutCHF
              ancReel += valCHF - p.coutCHF * (1 + inflationBetween(p.dateAchat, anchorDateStr))
            }
          }
          anchorNomValue = ancNom; anchorReelValue = ancReel; anchorNomNoFXValue = ancNomNoFX
        }
      }

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        // Mode hebdomadaire : évaluer au dimanche (fin de semaine) pour capturer le
        // vendredi via forward-fill. Placer le point sur le lundi (dateStr) en x/label.
        // Mode mensuel : évaluer au dernier jour du mois (même logique que weekly → dimanche).
        const evalDateStr = range === 'weekly' ? (() => {
          const sun = new Date(dateStr); sun.setDate(sun.getDate() + 6)
          const sunStr = sun.toISOString().slice(0, 10)
          return sunStr <= today ? sunStr : today
        })() : range === 'all' ? (() => {
          const [dy, dm] = dateStr.split('-').map(Number)
          const lastDay = new Date(dy, dm, 0) // dernier jour du mois en heure locale
          const s = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
          return s <= today ? s : today
        })() : dateStr
        const isToday = (interval === '5min' || interval === '1h' || interval === '4h') ? false : evalDateStr >= today
        const activePosns = data.filter(p => p.dateAchat <= evalDateStr)
        if (activePosns.length === 0) {
          if ((range === 'all' || range === 'weekly') && result.length === 0) {
            const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
            const label = range === 'weekly' ? fmtDate(dateStr) : fmtMonth(dateStr)
            result.push({ x: t, nominal: 0, reel: 0, reelKnown: false, nominalNoFX: 0, cost: 0, label })
          } else if (interval === '1day' && result.length === 0 && i === 0) {
            // YTD/1M/1Y : pas de positions à la date de départ → ancrer le premier point au niveau de référence
            result.push({ x: 0, nominal: anchorNomValue, reel: anchorReelValue, reelKnown: cpiDateKnown(dateStr), nominalNoFX: anchorNomNoFXValue, cost: 0, label: fmtDay(dateStr) })
          }
          setProgress(Math.round((i + 1) / dates.length * 100)); continue
        }

        const prices = await Promise.all(activePosns.map(async p => {
          if (!isToday) {
            const price = lookupClose(p.ticker, evalDateStr)
            if (price !== null) {
              const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const fxRate = fxPair ? (lookupClose(fxPair, evalDateStr) ?? p.tauxActuelCHF) : 1
              return { price, fxRate }
            }
            // Pas de prix dans l'hist pour cette date → oldest known (évite tout appel API supplémentaire)
            const h = histJson[p.ticker.toUpperCase()]
            const fxKey = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
            const hFx = fxKey ? histJson[fxKey.toUpperCase()] : null
            return { price: h?.closes[0] ?? p.prixAchat, fxRate: hFx?.closes[0] ?? p.tauxAchatCHF }
          }
          const d = await fetchPriceCached(p.ticker, p.devise, undefined)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        let nominal = 0, reel = 0, nominalNoFX = 0, cost = 0
        for (let j = 0; j < activePosns.length; j++) {
          const p = activePosns[j]
          cost += Math.abs(p.coutCHF)
          if (p.quantite < 0 && p.prixVente != null) {
            // Lot de vente clôturé :
            //   qty(négatif) × price(t) × fx  → retire les unités vendues du lot long
            //   + valeurCHF (produits encaissés, fixe) → ajoute le gain réalisé
            // = PnL sur 800 unités restantes + gain réalisé sur 200 vendues
            const valCHF   = p.quantite * prices[j].price * prices[j].fxRate
            const valNoFX  = p.quantite * prices[j].price * p.tauxAchatCHF
            nominal    += valCHF + p.valeurCHF
            nominalNoFX += valNoFX + Math.abs(p.quantite) * p.prixVente * p.tauxAchatCHF
            reel       += valCHF + p.valeurCHF - p.coutCHF * inflationBetween(p.dateAchat, evalDateStr)
          } else {
            const valCHF = p.quantite * prices[j].price * prices[j].fxRate
            const valNoFX = p.quantite * prices[j].price * p.tauxAchatCHF
            const infAdj = p.coutCHF * (1 + inflationBetween(p.dateAchat, evalDateStr))
            nominal += valCHF - p.coutCHF
            nominalNoFX += valNoFX - p.coutCHF
            reel    += valCHF - infAdj
          }
        }

        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const _spanMs = dateFrom ? (new Date(dateTo ?? today).getTime() - new Date(dateFrom).getTime()) : Infinity
        const label = (interval === '5min') ? fmtTime(dateStr) : (interval === '1h' || interval === '4h') ? fmtHourDayFull(dateStr) : range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : (timePeriod === '1Y' || (timePeriod === 'Max' && _spanMs > 365 * 24 * 3600 * 1000)) ? fmtDayMonthYear(dateStr) : fmtDayMonth(dateStr)
        result.push({ x: isToday ? 1 : t, nominal, reel, reelKnown: cpiDateKnown(evalDateStr), nominalNoFX, cost, label })
        setProgress(Math.round((i + 1) / dates.length * 100))
      }
      // ─── Point temps réel (valeur actuelle précise via fetchPriceCached) ──────────
      if (!cancelled) {
        const nowActivePosns = data.filter(p => p.dateAchat <= today)
        if (nowActivePosns.length > 0) {
          const nowPrices = await Promise.all(nowActivePosns.map(async p => {
            const d = await fetchPriceCached(p.ticker, p.devise, undefined)
            return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
          }))
          let nowNominal = 0, nowReel = 0, nowNominalNoFX = 0, nowCost = 0
          for (let jj = 0; jj < nowActivePosns.length; jj++) {
            const pp = nowActivePosns[jj]
            nowCost += Math.abs(pp.coutCHF)
            if (pp.quantite < 0 && pp.prixVente != null) {
              const valCHF   = pp.quantite * nowPrices[jj].price * nowPrices[jj].fxRate
              const valNoFX  = pp.quantite * nowPrices[jj].price * pp.tauxAchatCHF
              nowNominal    += valCHF + pp.valeurCHF
              nowNominalNoFX += valNoFX + Math.abs(pp.quantite) * pp.prixVente * pp.tauxAchatCHF
              nowReel       += valCHF + pp.valeurCHF - pp.coutCHF * inflationBetween(pp.dateAchat, today)
            } else {
              const valCHF  = pp.quantite * nowPrices[jj].price * nowPrices[jj].fxRate
              const valNoFX = pp.quantite * nowPrices[jj].price * pp.tauxAchatCHF
              nowNominal    += valCHF - pp.coutCHF
              nowNominalNoFX += valNoFX - pp.coutCHF
              nowReel       += valCHF - pp.coutCHF * (1 + inflationBetween(pp.dateAchat, today))
            }
          }
          result.push({ x: 1, nominal: nowNominal, reel: nowReel, reelKnown: cpiDateKnown(today), nominalNoFX: nowNominalNoFX, cost: nowCost, label: 'Actuel' })
        }
      }
      // Normaliser le premier point à 0 pour les modes mensuel et hebdomadaire
      if ((range === 'all' || range === 'weekly') && result.length > 0) {
        const off = { nominal: result[0].nominal, reel: result[0].reel, nominalNoFX: result[0].nominalNoFX }
        for (const pt of result) { pt.nominal -= off.nominal; pt.reel -= off.reel; pt.nominalNoFX -= off.nominalNoFX }
      }
      // YTD/1M/1Y : ancrer la courbe au bord gauche avec la première vraie valeur
      if (interval === '1day' && dateFrom && result.length > 0 && result[0].x > 0.001) {
        result[0].x = 0
      }
      const filtered1h = result.length > 1
        ? result.filter((pt, i) => i === 0 || Math.abs(pt.nominal - result[i - 1].nominal) > 0.001)
        : result
      const finalResult = filtered1h.length > 1
        ? filtered1h.map((pt, i) => ({ ...pt, x: i / (filtered1h.length - 1) }))
        : filtered1h
      const sampledResult = downsampleEvery > 1 ? finalResult.filter((_, i) => i % downsampleEvery === 0 || i === finalResult.length - 1) : finalResult
      if (!cancelled) { setMonthlyPts(sampledResult); setAnchorNominal(anchorNomValue); setAnchorReel(anchorReelValue); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  const points = monthlyPts

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <div className="w-48 h-1.5 bg-[#DDD9D1] dark:bg-[#2a3f52] rounded-full overflow-hidden">
        <div className="h-full bg-[#14B8A6] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-[#9E9A93]">{range === '60d' ? 'Chargement 60 jours…' : range === 'weekly' ? 'Chargement des données hebdomadaires…' : 'Chargement des données mensuelles…'} {progress}%</p>
    </div>
  )

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      {range === 'weekly' ? 'Détention trop courte pour la vue hebdomadaire' : range === '60d' ? 'Pas assez de données sur 60 jours' : 'Détention trop courte pour la vue mensuelle'}
    </div>
  )

  const zP = zoomWPnl
  const isZoomedPnl = zP[0] > 0.001 || zP[1] < 0.999
  const visPtsP = points.filter(p => p.x >= zP[0] - 0.001 && p.x <= zP[1] + 0.001)
  const visPtsPReel = visPtsP.filter(p => p.reelKnown)
  const firstVisP = visPtsP[0] ?? points[0]
  // 1A : offset visuel uniquement — décale la courbe réelle au rendu sans toucher aux données
  // Le header continue d'afficher _pnlDisp.reel - anchorReel (valeur absolue depuis l'achat)
  const reelRenderOffset = (timePeriod === '1Y' && visPtsPReel.length > 0)
    ? visPtsPReel[0].reel - visPtsPReel[0].nominal
    : 0
  const rr = (v: number) => v - reelRenderOffset
  // Affiche la courbe réelle sauf sur 1J/1S/1M
  const showReelChart = showReel && !['1D', '1W', '1M'].includes(timePeriod ?? '')
  const scalePtsP = isZoomedPnl && visPtsP.length > 1 ? visPtsP : points
  const allValsVis = scalePtsP.flatMap(p => {
    const arr: number[] = []
    if (showNominal) arr.push(p.nominal)
    if (showReelChart) arr.push(rr(p.reel))
    return arr
  })
  const allValsFallbackVis = allValsVis.length ? allValsVis : scalePtsP.flatMap(p => [p.nominal])
  const _maxRawVis = Math.max(...allValsFallbackVis)
  const _minRawVis = Math.min(...allValsFallbackVis)
  const rawSpanPnlVis = (_maxRawVis - _minRawVis) || Math.abs(_maxRawVis) * 0.1 || 1
  const rawStepPnlVis = rawSpanPnlVis / 4
  const magPnlVis = Math.pow(10, Math.floor(Math.log10(rawStepPnlVis)))
  const normPnlVis = rawStepPnlVis / magPnlVis
  const niceStepVis = (normPnlVis < 1.5 ? 1 : normPnlVis < 3 ? 2 : normPnlVis < 7 ? 5 : 10) * magPnlVis
  const minVVis = Math.floor(_minRawVis / niceStepVis) * niceStepVis
  const maxVVis = Math.ceil(_maxRawVis / niceStepVis) * niceStepVis
  const spanVis = maxVVis - minVVis || 1
  const px = (t: number) => PAD.l + ((t - zP[0]) / (zP[1] - zP[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minVVis) / spanVis) * iH
  const tickVals = Array.from({ length: Math.round((maxVVis - minVVis) / niceStepVis) + 1 }, (_, i) => minVVis + i * niceStepVis)
  const zeroY = py(0)

  const nomAreas = showNominal ? buildColoredAreas(points.map(p => ({ x: p.x, val: p.nominal, base: anchorNominal })), px, py) : { gainD: '', lossD: '' }
  const reelKnownPts = points.filter(p => p.reelKnown)
  const reelAreas = showReelChart ? buildColoredAreas(reelKnownPts.map(p => ({ x: p.x, val: rr(p.reel), base: 0 })), px, py) : { gainD: '', lossD: '' }
  const lastVisP = visPtsP[visPtsP.length - 1] ?? points[points.length - 1]

  const _pnlDisp = hoverIdxPnl !== null ? points[hoverIdxPnl] : points[points.length - 1]
  // Réel visible seulement sur 1Y/YTD/Max ET quand le point survolé a un IPC connu
  const reelVisible = showReel && !['1D', '1W', '1M'].includes(timePeriod ?? '') && !!_pnlDisp?.reelKnown
  // 1A : valeur réelle normalisée depuis le premier point du graphique (cohérent avec le visuel)
  const reelDisp = _pnlDisp ? (timePeriod === '1Y' ? rr(_pnlDisp.reel) - anchorNominal : _pnlDisp.reel - anchorReel) : 0

  return (
    <>
    {/* ── Stat header + toggle buttons ── */}
    <div className="flex items-start justify-between mb-3 px-5">
      <div className="min-h-[52px]">
        {_pnlDisp ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              {showNominal && (
                <span className={`text-2xl font-bold tabular-nums ${_pnlDisp.nominal >= anchorNominal ? 'text-[#14B8A6]' : 'text-[#EF4444]'}`}>
                  {(_pnlDisp.nominal - anchorNominal) >= 0 ? '+' : ''}{(_pnlDisp.nominal - anchorNominal).toFixed(2)} CHF
                </span>
              )}
              {reelVisible && !showNominal && (
                <span className={`text-2xl font-bold tabular-nums text-[#1B5C80]`}>
                  {reelDisp >= 0 ? '+' : ''}{reelDisp.toFixed(2)} CHF
                </span>
              )}
              {reelVisible && !showNominal && _pnlDisp.cost > 0 && (
                <span className={`text-sm font-semibold tabular-nums text-[#1B5C80]`}>
                  ({reelDisp >= 0 ? '+' : ''}{(reelDisp / _pnlDisp.cost * 100).toFixed(2)}%)
                </span>
              )}
              {showNominal && _pnlDisp.cost > 0 && (
                <span className={`text-sm font-semibold tabular-nums ${_pnlDisp.nominal >= anchorNominal ? 'text-[#14B8A6]' : 'text-[#EF4444]'}`}>
                  ({(_pnlDisp.nominal - anchorNominal) >= 0 ? '+' : ''}{((_pnlDisp.nominal - anchorNominal) / _pnlDisp.cost * 100).toFixed(2)}%)
                </span>
              )}
              {showNominal && reelVisible && (
                <span className={`text-sm font-semibold tabular-nums text-[#1B5C80]`}>
                  Réel {reelDisp >= 0 ? '+' : ''}{reelDisp.toFixed(2)} CHF
                  {_pnlDisp.cost > 0 && <> ({reelDisp >= 0 ? '+' : ''}{(reelDisp / _pnlDisp.cost * 100).toFixed(2)}%)</>}
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">

        {!['1D', '1W', '1M'].includes(timePeriod ?? '') && (
        <button type="button" onClick={() => setShowReel(v => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all ${showReel ? 'border-[#1B5C80] bg-[#F5F3EF] dark:bg-[#1E2530]' : 'border-[#DDD9D1] dark:border-[#323B4A] opacity-40'}`}>
          <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
          <span className="text-[#9E9A93]">Réel</span>
        </button>
        )}
        <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#EDEAE4] dark:bg-[#323B4A] text-[#9E9A93] text-[9px] font-bold cursor-help group/tipPnl">
          ?
          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2.5 py-2 bg-[#EDEAE4] dark:bg-[#323B4A] text-[#4B4945] dark:text-[#C8C4BC] text-[10px] rounded shadow-md opacity-0 group-hover/tipPnl:opacity-100 transition-opacity z-50 leading-relaxed space-y-1.5">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <svg width="20" height="10" className="flex-shrink-0"><line x1="0" y1="5" x2="10" y2="5" stroke="#14B8A6" strokeWidth="2" /><line x1="10" y1="5" x2="20" y2="5" stroke="#EF4444" strokeWidth="2" /></svg>
              <span><span className="font-semibold">Nominal</span> — gain/perte brut</span>
            </span>
            {!['1D', '1W', '1M'].includes(timePeriod ?? '') && (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <svg width="20" height="10" className="flex-shrink-0"><line x1="0" y1="5" x2="20" y2="5" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
              <span><span className="font-semibold">Réel</span> — ajusté de l&apos;inflation</span>
            </span>
            )}
          </span>
        </span>
      </div>
    </div>
    {isZoomedPnl && (
      <div className="flex justify-end mb-1 px-5">
        <button type="button" onClick={() => setZoomWPnl([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#14B8A6] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#323B4A]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg ref={chartProbeRef} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: H, cursor: isZoomedPnl ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdxPnl(null); setHoverMxPnl(null); zoomDragPnl.current = null }}
      onMouseDown={e => {
        if (!isZoomedPnl) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragPnl.current = { startX: mx, startZoom: [zP[0], zP[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragPnl.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragPnl.current) {
          const delta = (zoomDragPnl.current.startX - mx) / iW * (zP[1] - zP[0])
          const [z0, z1] = zoomDragPnl.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWPnl([newZ0, newZ0 + sp])
          return
        }
        const t = zP[0] + ((mx - PAD.l) / iW) * (zP[1] - zP[0])
        let best = -1, bd = Infinity
        points.forEach((p, i) => {
          if (p.x < zP[0] - 0.001 || p.x > zP[1] + 0.001) return
          const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i }
        })
        if (best < 0) return
        setHoverIdxPnl(best); setHoverMxPnl(px(points[best].x))
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zP[0] + ((mx - PAD.l) / iW) * (zP[1] - zP[0])
        const factor = zP[1] - zP[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zP[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWPnl([newZ0, newZ0 + nf])
      }}>
      <defs>
        <clipPath id="pnl-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="pnl-ng" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pnl-nl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.20" />
        </linearGradient>
        <linearGradient id="pnl-rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B5C80" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#1B5C80" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pnl-rl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <g clipPath="url(#pnl-clip)">
      {zeroY >= PAD.t && zeroY <= PAD.t + iH && Math.abs(zeroY - py(anchorNominal)) > 3 && (
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#6B7280" strokeWidth="1.5" opacity="0.7" />
      )}
      {(() => { const ancY = py(anchorNominal); return ancY >= PAD.t && ancY <= PAD.t + iH ? (
        <line x1={PAD.l} y1={ancY} x2={W - PAD.r} y2={ancY} stroke="var(--finv-cost-line)" strokeWidth="1" strokeDasharray="6 3" />
      ) : null })()}
      {showReelChart && (
        <>

          {(() => {
            const R = 4
            const rndPath = (pts: [number,number][]) => {
              if (pts.length < 2) return ''
              if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`
              let d = `M${pts[0][0]},${pts[0][1]}`
              for (let i = 1; i < pts.length - 1; i++) {
                const [ax,ay]=pts[i-1],[bx,by]=pts[i],[cx2,cy2]=pts[i+1]
                const d1=Math.sqrt((bx-ax)**2+(by-ay)**2), d2=Math.sqrt((cx2-bx)**2+(cy2-by)**2)
                const r=Math.min(R,d1/2,d2/2)
                d+=` L${bx-r*(bx-ax)/d1},${by-r*(by-ay)/d1} Q${bx},${by} ${bx+r*(cx2-bx)/d2},${by+r*(cy2-by)/d2}`
              }
              return d+` L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`
            }
            const runs: { color: string; pts: [number,number][] }[] = []
            let curColor = '', curPts: [number,number][] = []
            const flush = () => { if (curPts.length > 1) runs.push({ color: curColor, pts: [...curPts] }); curPts = [] }
            const addSeg = (x1: number, y1: number, x2: number, y2: number, col: string) => {
              if (col !== curColor) { flush(); curColor = col; curPts = [[x1,y1],[x2,y2]] }
              else { if (curPts.length === 0) curPts = [[x1,y1]]; curPts.push([x2,y2]) }
            }
            visPtsPReel.slice(0, -1).forEach((p0, i) => {
              const p1 = visPtsPReel[i + 1]
              addSeg(px(p0.x), py(rr(p0.reel)), px(p1.x), py(rr(p1.reel)), '#1B5C80')
            })
            flush()
            return runs.map((r, i) => <path key={i} d={rndPath(r.pts)} fill="none" stroke={r.color} strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />)
          })()}
        </>
      )}
      {showNominal && (
        <>

          {(() => {
            const R = 4
            const rndPath = (pts: [number,number][]) => {
              if (pts.length < 2) return ''
              if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`
              let d = `M${pts[0][0]},${pts[0][1]}`
              for (let i = 1; i < pts.length - 1; i++) {
                const [ax,ay]=pts[i-1],[bx,by]=pts[i],[cx2,cy2]=pts[i+1]
                const d1=Math.sqrt((bx-ax)**2+(by-ay)**2), d2=Math.sqrt((cx2-bx)**2+(cy2-by)**2)
                const r=Math.min(R,d1/2,d2/2)
                d+=` L${bx-r*(bx-ax)/d1},${by-r*(by-ay)/d1} Q${bx},${by} ${bx+r*(cx2-bx)/d2},${by+r*(cy2-by)/d2}`
              }
              return d+` L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`
            }
            const runs: { color: string; pts: [number,number][] }[] = []
            let curColor = '', curPts: [number,number][] = []
            const flush = () => { if (curPts.length > 1) runs.push({ color: curColor, pts: [...curPts] }); curPts = [] }
            const addSeg = (x1: number, y1: number, x2: number, y2: number, col: string) => {
              if (col !== curColor) { flush(); curColor = col; curPts = [[x1,y1],[x2,y2]] }
              else { if (curPts.length === 0) curPts = [[x1,y1]]; curPts.push([x2,y2]) }
            }
            points.slice(0, -1).forEach((p0, i) => {
              const p1 = points[i + 1]
              const d0 = p0.nominal, d1 = p1.nominal
              const r0 = d0 - anchorNominal, r1 = d1 - anchorNominal
              if (r0 >= 0 && r1 >= 0) { addSeg(px(p0.x), py(d0), px(p1.x), py(d1), '#14B8A6') }
              else if (r0 <= 0 && r1 <= 0) { addSeg(px(p0.x), py(d0), px(p1.x), py(d1), '#EF4444') }
              else {
                const t = r0 / (r0 - r1)
                const cx = px(p0.x) + t * (px(p1.x) - px(p0.x))
                const cy = py(d0) + t * (py(d1) - py(d0))
                addSeg(px(p0.x), py(d0), cx, cy, r0 > 0 ? '#14B8A6' : '#EF4444')
                addSeg(cx, cy, px(p1.x), py(d1), r0 > 0 ? '#EF4444' : '#14B8A6')
              }
            })
            flush()
            return runs.map((r, i) => <path key={i} d={rndPath(r.pts)} fill="none" stroke={r.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)
          })()}
        </>
      )}

      </g>
      {showNominal && <><circle cx={px(points[points.length-1].x)} cy={py(points[points.length-1].nominal)} r="7" fill="none" stroke={points[points.length-1].nominal >= anchorNominal ? '#14B8A6' : '#EF4444'} strokeWidth="1" strokeOpacity="0.35" /><circle cx={px(points[points.length-1].x)} cy={py(points[points.length-1].nominal)} r="4" fill={points[points.length-1].nominal >= anchorNominal ? '#14B8A6' : '#EF4444'} /></>}
      {showReelChart && points[points.length-1]?.reelKnown && <><circle cx={px(points[points.length-1].x)} cy={py(rr(points[points.length-1].reel))} r="5.5" fill="none" stroke="#1B5C80" strokeWidth="1" strokeOpacity="0.35" /><circle cx={px(points[points.length-1].x)} cy={py(rr(points[points.length-1].reel))} r="3.5" fill="#1B5C80" /></>}
      {hoverIdxPnl !== null && (() => {
        const hov = points[hoverIdxPnl]
        const mx = hoverMxPnl ?? px(hov.x)
        const refV = showNominal ? hov.nominal : showReelChart ? rr(hov.reel) : 0
        const lx = Math.min(Math.max(mx, PAD.l + 22), W - PAD.r - 22)
        const labelAbove = py(refV) < PAD.t + 28
        const ly = labelAbove ? py(refV) + 20 : py(refV) - 28
        return (
          <g>
            <line x1={mx} y1={PAD.t} x2={mx} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
            {showReelChart && hov.reelKnown && <circle cx={px(hov.x)} cy={py(rr(hov.reel))} r="4" fill="#1B5C80" />}
            {showNominal && <circle cx={px(hov.x)} cy={py(hov.nominal)} r="4" fill={hov.nominal >= anchorNominal ? '#14B8A6' : '#EF4444'} />}
            <g transform={`translate(${lx},${ly})`}>
              {(() => { const lw = Math.round(hov.label.length * 5.4 + 14); return (<><rect x={-lw/2} y="-9" width={lw} height="18" rx="3" style={{fill:'var(--chart-lbl-bg)'}} opacity="0.95" /><text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="600" style={{fill:'var(--chart-lbl-text)'}}>{hov.label}</text></>) })()}
            </g>
          </g>
        )
      })()}
    </svg>

    </>
  )
})


// ─── Chart: Drawdown ─────────────────────────────────────────────────────────
const DrawdownChart = React.memo(function DrawdownChart({ data, onMaxDrawdown, range, interval = '1day', dateFrom, dateTo, bustKey = 0, downsampleEvery = 1, timePeriod }: { data: PositionCalc[]; onMaxDrawdown?: (pct: number, date: string) => void; range?: 'all' | '60d' | 'weekly'; interval?: '1day' | '1h' | '4h' | '5min'; dateFrom?: string; dateTo?: string; bustKey?: number; downsampleEvery?: number; timePeriod?: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max' }) {
  const H = 195, PAD = { t: 10, r: 10, b: 10, l: 10 }

  const [ddPts, setDdPts] = useState<{ x: number; dd: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverMxDd, setHoverMxDd] = useState<number | null>(null)
  const [zoomWDd, setZoomWDd] = useState<[number, number]>([0, 1])
  const zoomDragDd = useRef<{ startX: number; startZoom: [number, number] } | null>(null)

  // Drawdown calculé sur le PnL nominal (comme PnLChart) — inclut delta lots pour cohérence
  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].filter(p => p.quantite > 0).sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date()
    const pad2b = (n: number) => String(n).padStart(2, '0')
    if (interval === '5min') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(); start.setHours(0,0,0,0)
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 5*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:${pad2b(d.getMinutes())}:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '1h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 60*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (interval === '4h') {
      const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : (() => { const d = new Date(); d.setMonth(d.getMonth()-1); d.setHours(0,0,0,0); return d })()
      const end = new Date(); const list: string[] = []
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 4*60*60*1000))
        list.push(`${d.getFullYear()}-${pad2b(d.getMonth()+1)}-${pad2b(d.getDate())} ${pad2b(d.getHours())}:00:00`)
      return { dates: list, firstDate: start, totalMs: (end.getTime() - start.getTime()) || 1 }
    }
    if (range === '60d') {
      const list: string[] = []
      if (dateFrom && dateTo) {
        let d = new Date(dateFrom)
        const end = new Date(dateTo)
        while (d <= end) { list.push(d.toISOString().slice(0, 10)); d = new Date(d); d.setDate(d.getDate() + 1) }
      } else {
        for (let i = 59; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); list.push(d.toISOString().slice(0, 10)) }
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: (new Date(list[list.length - 1]).getTime() - first.getTime()) || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      // Partir du lundi de la semaine contenant le premier achat
      const [fy, fm, fd] = sorted[0].dateAchat.split('-').map(Number)
      const firstLocal = new Date(fy, fm - 1, fd)
      const dow = firstLocal.getDay() // 0=dim, 1=lun, ..., 6=sam
      const daysToMon = dow === 0 ? 6 : dow - 1
      const startMonday = new Date(firstLocal)
      startMonday.setDate(firstLocal.getDate() - daysToMon)
      const list: string[] = []
      let d = new Date(startMonday)
      while (d <= today) {
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: startMonday, totalMs: (today.getTime() - startMonday.getTime()) || 1 }
    }
    // Partir du mois du premier achat
    const list: string[] = []
    let dYear = first.getFullYear(), dMonth = first.getMonth()
    const todayYM = today.getFullYear() * 12 + today.getMonth()
    while (dYear * 12 + dMonth <= todayYM) {
      list.push(`${dYear}-${String(dMonth + 1).padStart(2, '0')}-01`)
      dMonth++; if (dMonth > 11) { dMonth = 0; dYear++ }
    }
    return { dates: list, firstDate: new Date(first.getFullYear(), first.getMonth(), 1), totalMs: ms || 1 }
  }, [data, range, interval, dateFrom, dateTo])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + (interval ?? '1day') + '|' + (dateFrom ?? '') + '|' + (dateTo ?? '') + '|' + bustKey + '|' + downsampleEvery, [data, range, interval, dateFrom, dateTo, bustKey, downsampleEvery])
  const _bustLastSeenDD = useRef(0)
  const [measuredW, setMeasuredW] = useState(0)
  const chartProbeRef = useCallback((node: SVGSVGElement | null) => {
    if (!node) return
    const update = () => setMeasuredW(node.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
  }, [])
  const W = measuredW > 0 ? measuredW : 600
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true)
    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)

      // ─── Bulk history (long lots uniquement pour VLU) ─────────────────────
      const longLots = data.filter(p => p.quantite > 0)
      const allTickers = [...new Set(longLots.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(longLots.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeenDD.current; _bustLastSeenDD.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust, interval) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)

      // ─── Événements de flux de capital (triés par date) ──────────────────
      // Achat = entrée de capital (nouvelle position longue)
      // Vente = sortie de capital (clôture totale ou vente partielle)
      type CfEvent = { date: string; type: 'buy' | 'sell'; amount: number }
      const cfEvents: CfEvent[] = []
      for (const p of data) {
        if (p.quantite > 0) {
          cfEvents.push({ date: p.dateAchat, type: 'buy', amount: p.coutCHF })
          if (p.dateVente) cfEvents.push({ date: p.dateVente, type: 'sell', amount: p.valeurCHF })
        } else if (p.quantite < 0 && p.prixVente != null) {
          // delta lot : dateAchat = date de vente, valeurCHF = produit de cession
          cfEvents.push({ date: p.dateAchat, type: 'sell', amount: p.valeurCHF })
        }
      }
      cfEvents.sort((a, b) => a.date.localeCompare(b.date))
      let cfIdx = 0

      // ─── État VLU (Valeur Liquidative Unitaire) ───────────────────────────
      // On suit des «parts» comme un fonds : quand du capital entre/sort, on
      // crée/détruit des parts au prix unitaire du moment → le drawdown ne
      // reflète que la performance marché, pas les mouvements de capital.
      const INITIAL_UNITS = 10000
      let totalUnits = 0          // nombre de parts en circulation
      let prevPortfolioV = 0      // valeur du portefeuille à la date précédente traitée
      let peakUnitV = -Infinity   // pic de la valeur liquidative unitaire
      const result: { x: number; dd: number; label: string }[] = []

      // Delta lots pour calcul des quantités nettes par ticker
      const allDeltaLots = data.filter(p => p.quantite < 0 && p.prixVente != null)

      // ─── Phase de préchauffage VLU ────────────────────────────────────────
      // Si une dateFrom est fournie (plage personnalisée), on reconstitue
      // l'état VLU (parts, pic) depuis le début de l'historique jusqu'à
      // dateFrom exclusif. Ainsi le graphique et la carte DRAWDOWN MAX
      // sont cohérents (même base de calcul).
      if (dateFrom) {
        const minDateAchat = longLots.reduce((m, p) => p.dateAchat < m ? p.dateAchat : m, '9999-99-99')
        const warmupDates: string[] = []
        let wdCur = new Date(minDateAchat)
        const wdEnd = new Date(dateFrom)
        while (wdCur < wdEnd) {
          warmupDates.push(wdCur.toISOString().slice(0, 10))
          wdCur.setDate(wdCur.getDate() + 1)
        }
        for (const wDate of warmupDates) {
          if (cancelled) return
          const wActiveLong = longLots.filter(p =>
            p.dateAchat <= wDate && (!p.dateVente || p.dateVente > wDate)
          )
          if (wActiveLong.length === 0) {
            while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= wDate) cfIdx++
            continue
          }
          const wAllHaveData = wActiveLong.every(p => lookupClose(p.ticker, wDate) !== null)
          if (!wAllHaveData) continue
          let netCf = 0
          while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= wDate) {
            const cf = cfEvents[cfIdx++]
            netCf += cf.type === 'buy' ? cf.amount : -cf.amount
          }
          const uniqueW = [...new Set(wActiveLong.map(p => p.ticker.toUpperCase()))]
          const wPriceMap = new Map<string, { price: number; fxRate: number }>()
          for (const tk of uniqueW) {
            const lot = wActiveLong.find(p => p.ticker.toUpperCase() === tk)!
            const price = lookupClose(tk, wDate)!
            const fxPair = lot.devise !== 'CHF' ? `${lot.devise}CHF=X` : null
            const fxRate = fxPair ? (lookupClose(fxPair, wDate) ?? lot.tauxActuelCHF) : 1
            wPriceMap.set(tk, { price, fxRate })
          }
          const wNetQty = new Map<string, number>()
          for (const p of wActiveLong) {
            const tk = p.ticker.toUpperCase()
            wNetQty.set(tk, (wNetQty.get(tk) ?? 0) + p.quantite)
          }
          for (const p of allDeltaLots) {
            if (p.dateAchat <= wDate) {
              const tk = p.ticker.toUpperCase()
              wNetQty.set(tk, (wNetQty.get(tk) ?? 0) + p.quantite)
            }
          }
          let wPortfolioV = 0
          for (const [tk, netQty] of wNetQty) {
            if (netQty <= 0) continue
            const pr = wPriceMap.get(tk)
            if (!pr) continue
            wPortfolioV += netQty * pr.price * pr.fxRate
          }
          if (wPortfolioV <= 0) { prevPortfolioV = 0; continue }
          if (totalUnits === 0) {
            totalUnits = INITIAL_UNITS
          } else if (netCf !== 0) {
            const prevUnitV = prevPortfolioV > 0 ? prevPortfolioV / totalUnits : wPortfolioV / INITIAL_UNITS
            if (prevUnitV > 0) totalUnits += netCf / prevUnitV
            if (totalUnits <= 0) totalUnits = INITIAL_UNITS
          }
          prevPortfolioV = wPortfolioV
          const wUnitV = wPortfolioV / totalUnits
          if (wUnitV > peakUnitV) peakUnitV = wUnitV
        }
      } else if (range === '60d' && !dateFrom && dates.length > 0) {
        // ─── Préchauffage VLU pour vue 60j ───────────────────────────────
        // On reconstitue l'état VLU depuis le premier achat jusqu'à la veille
        // du premier point affiché, pour que le drawdown parte de son vrai niveau
        // (et non de 0) même quand le portefeuille a une historique plus longue.
        const minDateAchat60 = longLots.reduce((m, p) => p.dateAchat < m ? p.dateAchat : m, '9999-99-99')
        const startStr60 = dates[0]
        if (minDateAchat60 < startStr60) {
          let wdCur60 = new Date(minDateAchat60)
          const wdEnd60 = new Date(startStr60)
          while (wdCur60 < wdEnd60) {
            if (cancelled) return
            const wDate = wdCur60.toISOString().slice(0, 10)
            wdCur60.setDate(wdCur60.getDate() + 1)
            const wActiveLong = longLots.filter(p =>
              p.dateAchat <= wDate && (!p.dateVente || p.dateVente > wDate)
            )
            if (wActiveLong.length === 0) {
              while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= wDate) cfIdx++
              continue
            }
            const wAllHaveData = wActiveLong.every(p => lookupClose(p.ticker, wDate) !== null)
            if (!wAllHaveData) continue
            let netCf = 0
            while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= wDate) {
              const cf = cfEvents[cfIdx++]
              netCf += cf.type === 'buy' ? cf.amount : -cf.amount
            }
            const uniqueW = [...new Set(wActiveLong.map(p => p.ticker.toUpperCase()))]
            const wPriceMap = new Map<string, { price: number; fxRate: number }>()
            for (const tk of uniqueW) {
              const lot = wActiveLong.find(p => p.ticker.toUpperCase() === tk)!
              const price = lookupClose(tk, wDate)!
              const fxPair = lot.devise !== 'CHF' ? `${lot.devise}CHF=X` : null
              const fxRate = fxPair ? (lookupClose(fxPair, wDate) ?? lot.tauxActuelCHF) : 1
              wPriceMap.set(tk, { price, fxRate })
            }
            const wNetQty = new Map<string, number>()
            for (const p of wActiveLong) {
              const tk = p.ticker.toUpperCase()
              wNetQty.set(tk, (wNetQty.get(tk) ?? 0) + p.quantite)
            }
            for (const p of allDeltaLots) {
              if (p.dateAchat <= wDate) {
                const tk = p.ticker.toUpperCase()
                wNetQty.set(tk, (wNetQty.get(tk) ?? 0) + p.quantite)
              }
            }
            let wPortfolioV = 0
            for (const [tk, netQty] of wNetQty) {
              if (netQty <= 0) continue
              const pr = wPriceMap.get(tk)
              if (!pr) continue
              wPortfolioV += netQty * pr.price * pr.fxRate
            }
            if (wPortfolioV <= 0) { prevPortfolioV = 0; continue }
            if (totalUnits === 0) {
              totalUnits = INITIAL_UNITS
            } else if (netCf !== 0) {
              const prevUnitV = prevPortfolioV > 0 ? prevPortfolioV / totalUnits : wPortfolioV / INITIAL_UNITS
              if (prevUnitV > 0) totalUnits += netCf / prevUnitV
              if (totalUnits <= 0) totalUnits = INITIAL_UNITS
            }
            prevPortfolioV = wPortfolioV
            const wUnitV60 = wPortfolioV / totalUnits
            if (wUnitV60 > peakUnitV) peakUnitV = wUnitV60
          }
        }
      }
      // Réinitialiser le pic VLU après le préchauffage : le drawdown démarre à 0
      // au premier point affiché (relatif à la plage sélectionnée, pas à l'historique)
      peakUnitV = -Infinity

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        // Évaluer au dernier jour du mois (mensuel) ou dimanche (hebdo) — même logique qu'EvolChart/PnLChart
        const evalDateStr = range === 'weekly' ? (() => {
          const sun = new Date(dateStr); sun.setDate(sun.getDate() + 6)
          const s = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`
          return s <= today ? s : today
        })() : range === 'all' ? (() => {
          const [dy, dm] = dateStr.split('-').map(Number)
          const lastDay = new Date(dy, dm, 0) // dernier jour du mois en heure locale
          const s = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
          return s <= today ? s : today
        })() : dateStr
        const isToday = (interval === '5min' || interval === '1h' || interval === '4h') ? false : evalDateStr >= today

        // Long lots actifs à cette date (achetés et pas encore vendus)
        const activeLong = longLots.filter(p =>
          p.dateAchat <= evalDateStr && (!p.dateVente || p.dateVente > evalDateStr)
        )
        if (activeLong.length === 0) {
          // Avancer cfIdx même si aucun lot actif (flux sans position = edge case)
          while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= evalDateStr) cfIdx++
          continue
        }

        // Vérifier disponibilité des données avant de consommer les flux
        if (!isToday) {
          const allHaveData = activeLong.every(p => lookupClose(p.ticker, evalDateStr) !== null)
          if (!allHaveData) continue // ne pas avancer cfIdx : les flux seront agrégés à la prochaine date valide
        }

        // Consommer les flux de capital entre la dernière date traitée et evalDateStr
        let netCf = 0
        while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= evalDateStr) {
          const cf = cfEvents[cfIdx++]
          netCf += cf.type === 'buy' ? cf.amount : -cf.amount
        }

        // Prix par ticker unique (évite les doublons pour les multi-lots)
        const uniqueTickers = [...new Set(activeLong.map(p => p.ticker.toUpperCase()))]
        const tickerPriceMap = new Map<string, { price: number; fxRate: number }>()
        await Promise.all(uniqueTickers.map(async tk => {
          const lot = activeLong.find(p => p.ticker.toUpperCase() === tk)!
          if (!isToday) {
            const price = lookupClose(tk, evalDateStr)!
            const fxPair = lot.devise !== 'CHF' ? `${lot.devise}CHF=X` : null
            const fxRate = fxPair ? (lookupClose(fxPair, evalDateStr) ?? lot.tauxActuelCHF) : 1
            tickerPriceMap.set(tk, { price, fxRate })
          } else {
            const d = await fetchPriceCached(lot.ticker, lot.devise, undefined)
            tickerPriceMap.set(tk, d ?? { price: lot.prixActuel, fxRate: lot.tauxActuelCHF })
          }
        }))

        // Quantité nette par ticker = lots longs actifs - ventes partielles exécutées à cette date
        const netQtyByTicker = new Map<string, number>()
        for (const p of activeLong) {
          const tk = p.ticker.toUpperCase()
          netQtyByTicker.set(tk, (netQtyByTicker.get(tk) ?? 0) + p.quantite)
        }
        for (const p of allDeltaLots) {
          if (p.dateAchat <= evalDateStr) {
            const tk = p.ticker.toUpperCase()
            netQtyByTicker.set(tk, (netQtyByTicker.get(tk) ?? 0) + p.quantite) // p.quantite < 0
          }
        }

        // Valeur de marché du portefeuille (positions nettes uniquement)
        let portfolioV = 0
        for (const [tk, netQty] of netQtyByTicker) {
          if (netQty <= 0) continue
          const pr = tickerPriceMap.get(tk)
          if (!pr) continue
          portfolioV += netQty * pr.price * pr.fxRate
        }
        if (portfolioV <= 0) { prevPortfolioV = 0; continue }

        // Ajuster le nombre de parts selon les flux de capital
        // Règle VLU : les parts sont créées/détruites au prix unitaire courant
        // → la valeur unitaire ne saute pas lors d'un flux externe
        if (totalUnits === 0) {
          // Premier point : initialisation
          totalUnits = INITIAL_UNITS
        } else if (netCf !== 0) {
          const prevUnitV = prevPortfolioV > 0 ? prevPortfolioV / totalUnits : portfolioV / INITIAL_UNITS
          if (prevUnitV > 0) totalUnits += netCf / prevUnitV
          if (totalUnits <= 0) totalUnits = INITIAL_UNITS
        }

        prevPortfolioV = portfolioV

        const unitV = portfolioV / totalUnits
        if (unitV > peakUnitV) peakUnitV = unitV

        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const _spanMs = dateFrom ? (new Date(dateTo ?? today).getTime() - new Date(dateFrom).getTime()) : Infinity
        const label = (interval === '5min') ? fmtTime(dateStr) : (interval === '1h' || interval === '4h') ? fmtHourDayFull(dateStr) : range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : (timePeriod === '1Y' || (timePeriod === 'Max' && _spanMs > 365 * 24 * 3600 * 1000)) ? fmtDayMonthYear(dateStr) : fmtDayMonth(dateStr)
        const dd = peakUnitV > 0 ? ((unitV - peakUnitV) / peakUnitV) * 100 : 0
        result.push({ x: isToday ? 1 : t, dd, label })
      }

      if (cancelled) return
      // YTD/1M/1Y : ancrer la courbe au bord gauche avec la première vraie valeur
      if (interval === '1day' && dateFrom && result.length > 0 && result[0].x > 0.001) {
        result[0].x = 0
      }
      // ─── Point temps réel (valeur actuelle précise via fetchPriceCached) ──────────
      if (!cancelled && totalUnits > 0) {
        const nowActiveLong = longLots.filter(p => p.dateAchat <= today && (!p.dateVente || p.dateVente > today))
        if (nowActiveLong.length > 0) {
          const nowUniqueTickers = [...new Set(nowActiveLong.map(p => p.ticker.toUpperCase()))]
          const nowPriceMap = new Map<string, { price: number; fxRate: number }>()
          await Promise.all(nowUniqueTickers.map(async tk => {
            const lot = nowActiveLong.find(p => p.ticker.toUpperCase() === tk)!
            const d = await fetchPriceCached(lot.ticker, lot.devise, undefined)
            nowPriceMap.set(tk, d ?? { price: lot.prixActuel, fxRate: lot.tauxActuelCHF })
          }))
          const nowNetQty = new Map<string, number>()
          for (const p of nowActiveLong) {
            const tk = p.ticker.toUpperCase()
            nowNetQty.set(tk, (nowNetQty.get(tk) ?? 0) + p.quantite)
          }
          for (const p of allDeltaLots) {
            if (p.dateAchat <= today) {
              const tk = p.ticker.toUpperCase()
              nowNetQty.set(tk, (nowNetQty.get(tk) ?? 0) + p.quantite)
            }
          }
          // Flush remaining cash-flow events
          let nowNetCf = 0
          let tmpCfIdx = cfIdx
          while (tmpCfIdx < cfEvents.length) {
            const cf = cfEvents[tmpCfIdx++]
            nowNetCf += cf.type === 'buy' ? cf.amount : -cf.amount
          }
          let nowPortfolioV = 0
          for (const [tk, netQty] of nowNetQty) {
            if (netQty <= 0) continue
            const pr = nowPriceMap.get(tk)
            if (!pr) continue
            nowPortfolioV += netQty * pr.price * pr.fxRate
          }
          if (nowPortfolioV > 0) {
            let nowTotalUnits = totalUnits
            if (nowNetCf !== 0) {
              const prevUnitV = prevPortfolioV > 0 ? prevPortfolioV / nowTotalUnits : nowPortfolioV / INITIAL_UNITS
              if (prevUnitV > 0) nowTotalUnits += nowNetCf / prevUnitV
              if (nowTotalUnits <= 0) nowTotalUnits = INITIAL_UNITS
            }
            const nowUnitV = nowPortfolioV / nowTotalUnits
            const nowPeak = Math.max(peakUnitV, nowUnitV)
            const nowDD = nowPeak > 0 ? ((nowUnitV - nowPeak) / nowPeak) * 100 : 0
            result.push({ x: 1, dd: nowDD, label: 'Actuel' })
          }
        }
      }
      const rawDD = result.length > 1
        ? result.filter((pt, i) => i === 0 || Math.abs(pt.dd - result[i - 1].dd) > 0.0001)
        : result
      const finalDD = rawDD.length > 1
        ? rawDD.map((pt, i) => ({ ...pt, x: i / (rawDD.length - 1) }))
        : rawDD
      const sampledDD = downsampleEvery > 1 ? finalDD.filter((_, i) => i % downsampleEvery === 0 || i === finalDD.length - 1) : finalDD
      const maxDDPt = sampledDD.reduce((m, p) => p.dd < m.dd ? p : m, sampledDD[0])
      if (onMaxDrawdown && maxDDPt) onMaxDrawdown(maxDDPt.dd, maxDDPt.label)
      setDdPts(sampledDD)
      setLoading(false)
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-[#9E9A93]">Calcul du drawdown…</div>
  const points = ddPts
  if (!points || points.length < 2) return null

  const zD = zoomWDd
  const isZoomedDd = zD[0] > 0.001 || zD[1] < 0.999
  const visPtsD = points.filter(p => p.x >= zD[0] - 0.001 && p.x <= zD[1] + 0.001)
  const firstVisD = visPtsD[0] ?? points[0]
  const lastVisD = visPtsD[visPtsD.length - 1] ?? points[points.length - 1]
  const scalePtsD = isZoomedDd && visPtsD.length > 1 ? visPtsD : points
  const minDD = Math.min(...scalePtsD.map(p => p.dd), -0.01)
  const maxV = 0, minV = minDD * 1.2, span = maxV - minV || 1
  const px = (t: number) => PAD.l + ((t - zD[0]) / (zD[1] - zD[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH
  const zeroY = py(0)
  const tickCount = 4
  const tickVals = Array.from({ length: tickCount + 1 }, (_, i) => minV + (span * i) / tickCount)
  const areaPath = [`M ${px(points[0].x)} ${zeroY}`, ...points.map(p => `L ${px(p.x)} ${py(p.dd)}`), `L ${px(points[points.length-1].x)} ${zeroY}`, 'Z'].join(' ')
  const maxDDPt = points.reduce((m, p) => p.dd < m.dd ? p : m, points[0])
  const hovered = hoverIdx !== null ? points[hoverIdx] : null
  const _ddDisp = hovered ?? (points.length > 0 ? points[points.length - 1] : null)

  return (
    <>
    {/* ── Stat header ── */}
    <div className="mb-3 min-h-[52px] px-5 flex items-start justify-between">
      <div>
        {_ddDisp ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-[#EF4444]">
              {_ddDisp.dd.toFixed(2)}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#EDEAE4] dark:bg-[#323B4A] text-[#9E9A93] text-[9px] font-bold cursor-help group/tipDD">
          ?
          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2.5 py-2 bg-[#EDEAE4] dark:bg-[#323B4A] text-[#4B4945] dark:text-[#C8C4BC] text-[10px] rounded shadow-md opacity-0 group-hover/tipDD:opacity-100 transition-opacity z-50 leading-relaxed space-y-1.5">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <svg width="20" height="10" className="flex-shrink-0"><path d="M0,2 Q10,10 20,2" fill="none" stroke="#EF4444" strokeWidth="1.5" /></svg>
              <span><span className="font-semibold">Drawdown</span> — recul depuis le plus haut</span>
            </span>
          </span>
        </span>
      </div>
    </div>
    {isZoomedDd && (
      <div className="flex justify-end mb-1 px-5">
        <button type="button" onClick={() => setZoomWDd([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#14B8A6] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#323B4A]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg ref={chartProbeRef} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: H, cursor: isZoomedDd ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdx(null); setHoverMxDd(null); zoomDragDd.current = null }}
      onMouseDown={e => {
        if (!isZoomedDd) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragDd.current = { startX: mx, startZoom: [zD[0], zD[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragDd.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragDd.current) {
          const delta = (zoomDragDd.current.startX - mx) / iW * (zD[1] - zD[0])
          const [z0, z1] = zoomDragDd.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWDd([newZ0, newZ0 + sp])
          return
        }
        const t = zD[0] + ((mx - PAD.l) / iW) * (zD[1] - zD[0])
        let best = -1, bd = Infinity
        points.forEach((p, i) => {
          if (p.x < zD[0] - 0.001 || p.x > zD[1] + 0.001) return
          const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i }
        })
        if (best < 0) return
        setHoverIdx(best); setHoverMxDd(px(points[best].x))
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zD[0] + ((mx - PAD.l) / iW) * (zD[1] - zD[0])
        const factor = zD[1] - zD[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zD[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWDd([newZ0, newZ0 + nf])
      }}
    >
      <defs>
        <clipPath id="dd-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g clipPath="url(#dd-clip)">
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#6B7280" strokeWidth="1.2" opacity="0.75" />
      <path d={areaPath} fill="url(#dd-fill)" />

      {(() => {
        const R = 4
        const pts: [number,number][] = points.map(p => [px(p.x), py(p.dd)])
        let d = pts.length < 2 ? '' : `M${pts[0][0]},${pts[0][1]}`
        for (let i = 1; i < pts.length - 1; i++) {
          const [ax,ay]=pts[i-1],[bx,by]=pts[i],[cx2,cy2]=pts[i+1]
          const d1=Math.sqrt((bx-ax)**2+(by-ay)**2), d2=Math.sqrt((cx2-bx)**2+(cy2-by)**2)
          const r=Math.min(R,d1/2,d2/2)
          d+=` L${bx-r*(bx-ax)/d1},${by-r*(by-ay)/d1} Q${bx},${by} ${bx+r*(cx2-bx)/d2},${by+r*(cy2-by)/d2}`
        }
        if (pts.length > 1) d+=` L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`
        return <path d={d} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      })()}
      <circle cx={px(maxDDPt.x)} cy={py(maxDDPt.dd)} r="3.5" fill="#EF4444" />
      {hovered && (
        <g>
          <line x1={hoverMxDd ?? px(hovered.x)} y1={PAD.t} x2={hoverMxDd ?? px(hovered.x)} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
          <circle cx={px(hovered.x)} cy={py(hovered.dd)} r="3" fill="#EF4444" />
          {(() => {
            const mx2 = hoverMxDd ?? px(hovered.x)
            const lx = Math.min(Math.max(mx2, PAD.l + 22), W - PAD.r - 22)
            const labelAbove = py(hovered.dd) < PAD.t + 28
            const ly = labelAbove ? py(hovered.dd) + 20 : py(hovered.dd) - 28
            return (
              <g transform={`translate(${lx}, ${ly})`}>
                {(() => { const lw = Math.round(hovered.label.length * 5.4 + 14); return (<><rect x={-lw/2} y="-9" width={lw} height="18" rx="3" style={{fill:'var(--chart-lbl-bg)'}} opacity="0.95" /><text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="600" style={{fill:'var(--chart-lbl-text)'}}>{hovered.label}</text></>) })()}
              </g>
            )
          })()}
        </g>
      )}
      </g>

    </svg>
    <div style={{ height: 32 }} />
    </>
  )
})



const CATS = ['ETF Oblig.', 'ETF', 'Actions', 'Matières premières', 'Monnaies', 'Crypto']
const CAT_VOL: Record<string, number> = {
  'ETF Oblig.': 0.08, 'ETF': 0.15, 'Actions': 0.25,
  'Matières premières': 0.20, 'Monnaies': 0.12, 'Crypto': 0.70,
}
const CORR: Record<string, Record<string, number>> = {
  'ETF Oblig.':        { 'ETF Oblig.': 1.00, 'ETF': -0.10, 'Actions': -0.05, 'Matières premières':  0.05, 'Monnaies': -0.15, 'Crypto':  0.00 },
  'ETF':                { 'ETF Oblig.': -0.10, 'ETF': 1.00, 'Actions':  0.80, 'Matières premières':  0.30, 'Monnaies':  0.10, 'Crypto':  0.20 },
  'Actions':            { 'ETF Oblig.': -0.05, 'ETF': 0.80, 'Actions':  1.00, 'Matières premières':  0.20, 'Monnaies':  0.05, 'Crypto':  0.25 },
  'Matières premières': { 'ETF Oblig.':  0.05, 'ETF': 0.30, 'Actions':  0.20, 'Matières premières':  1.00, 'Monnaies':  0.15, 'Crypto':  0.10 },
  'Monnaies':           { 'ETF Oblig.': -0.15, 'ETF': 0.10, 'Actions':  0.05, 'Matières premières':  0.15, 'Monnaies':  1.00, 'Crypto':  0.05 },
  'Crypto':             { 'ETF Oblig.':  0.00, 'ETF': 0.20, 'Actions':  0.25, 'Matières premières':  0.10, 'Monnaies':  0.05, 'Crypto':  1.00 },
}

// ─── Chart: Allocation ────────────────────────────────────────────
function AllocChart({ data }: { data: PositionCalc[] }) {
  const [hovered, setHovered] = React.useState<string | null>(null)
  // Valeur nette par catégorie — même logique FIFO que l'onglet Positions :
  //   1. Exclure les positions clôturées (dateVente présent)
  //   2. Grouper par ticker, calculer la quantité nette (lots longs − réductions)
  //   3. Si qté nette > 0 → valeur = qté nette × prix actuel × taux CHF
  const openVal = React.useMemo(() => {
    const byTicker: Record<string, PositionCalc[]> = {}
    for (const p of data) {
      if (p.dateVente) continue
      const k = p.ticker.toUpperCase();
      (byTicker[k] ??= []).push(p)
    }
    const result: { categorie: string; valeurCHF: number }[] = []
    for (const lots of Object.values(byTicker)) {
      const netQty = lots.reduce((s, p) => s + p.quantite, 0)
      if (netQty <= 0) continue
      const ref = lots.find(p => p.quantite > 0) ?? lots[0]
      result.push({ categorie: ref.categorie, valeurCHF: netQty * ref.prixActuel * ref.tauxActuelCHF })
    }
    return result
  }, [data])

  const totalVal = openVal.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null
  const allPortfolioCats = [...new Set(openVal.map(p => p.categorie))].filter(c => c && c !== 'Tout')
  const byCategory = allPortfolioCats
    .map(cat => ({ cat, val: openVal.filter(p => p.categorie === cat).reduce((s, p) => s + p.valeurCHF, 0), color: CAT_COLOR[cat] ?? '#8899AA' }))
    .filter(c => c.val > 0).sort((a, b) => b.val - a.val)

  const CX = 125, CY = 125, R = 100, IR = 78
  const GAP = 0.018 // radians gap between slices
  const slices: { cat: string; color: string; val: number; pct: number; startA: number; endA: number }[] = []
  let cursor = -Math.PI / 2
  for (const { cat, val, color } of byCategory) {
    const pct = val / totalVal
    const sweep = pct * 2 * Math.PI - GAP
    slices.push({ cat, color, val, pct: pct * 100, startA: cursor + GAP / 2, endA: cursor + GAP / 2 + sweep })
    cursor += pct * 2 * Math.PI
  }

  function arc(cx: number, cy: number, r: number, ir: number, startA: number, endA: number, expand = 0) {
    const cos = Math.cos, sin = Math.sin
    const re = r + expand, ire = ir - expand
    const x1 = cx + re * cos(startA), y1 = cy + re * sin(startA)
    const x2 = cx + re * cos(endA),   y2 = cy + re * sin(endA)
    const x3 = cx + ire * cos(endA),  y3 = cy + ire * sin(endA)
    const x4 = cx + ire * cos(startA),y4 = cy + ire * sin(startA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${re} ${re} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ire} ${ire} 0 ${large} 0 ${x4} ${y4} Z`
  }

  const hovSlice = slices.find(s => s.cat === hovered)
  const centerLabel = hovSlice
    ? { top: hovSlice.pct.toFixed(2) + '%', mid: hovSlice.cat, val: hovSlice.val.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CHF' }
    : { top: totalVal.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), mid: 'CHF total', val: null }

  return (
    <svg width="250" height="250" viewBox="0 0 250 250" style={{display:'block',margin:'0 auto'}}>
      {slices.map(s => (
        <path
          key={s.cat}
          d={arc(CX, CY, R, IR, s.startA, s.endA, hovered === s.cat ? 4 : 0)}
          fill={s.color}
          opacity={hovered && hovered !== s.cat ? 0.35 : 1}
          style={{ transition: 'opacity 0.15s, d 0.15s', cursor: 'pointer' }}
          onMouseEnter={() => setHovered(s.cat)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      <text x={CX} y={hovSlice ? CY - 14 : CY - 7} textAnchor="middle" fontSize="15" fontWeight="700"
        fill={hovSlice ? hovSlice.color : '#1B3050'} className="dark:fill-white font-mono" style={{transition:'y 0.15s'}}>
        {centerLabel.top}
      </text>
      <text x={CX} y={hovSlice ? CY + 5 : CY + 10} textAnchor="middle" fontSize="9.5" fill="#9E9A93" style={{transition:'y 0.15s'}}>
        {centerLabel.mid}
      </text>
      {hovSlice && <text x={CX} y={CY + 20} textAnchor="middle" fontSize="8.5" fill="#9E9A93" fontWeight="500">
        {centerLabel.val}
      </text>}
    </svg>
  )
}

// ─── Chart: Allocation par position ─────────────────────────────────────────
function PositionsAllocChart({ data }: { data: PositionCalc[] }) {
  const [hovered, setHovered] = React.useState<string | null>(null)

  const byTicker = React.useMemo(() => {
    const map: Record<string, PositionCalc[]> = {}
    for (const p of data) {
      if (p.dateVente) continue
      const k = p.ticker.toUpperCase();
      (map[k] ??= []).push(p)
    }
    const result: { ticker: string; nom: string; valeurCHF: number }[] = []
    for (const [ticker, lots] of Object.entries(map)) {
      const netQty = lots.reduce((s, p) => s + p.quantite, 0)
      if (netQty <= 0) continue
      const ref = lots.find(p => p.quantite > 0) ?? lots[0]
      result.push({ ticker, nom: ref.nom, valeurCHF: netQty * ref.prixActuel * ref.tauxActuelCHF })
    }
    return result.sort((a, b) => b.valeurCHF - a.valeurCHF)
  }, [data])

  const totalVal = byTicker.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null

  const colorPalette = [
    '#2563EB','#7C3AED','#6366F1','#3B82F6','#60A5FA','#93C5FD','#14B8A6',
    '#1D4ED8','#5B21B6','#4F46E5','#1E40AF','#2DD4BF','#0EA5E9','#7DD3FC',
    '#3730A3','#8B5CF6','#38BDF8','#A5B4FC','#67E8F9','#BAE6FD','#C4B5FD',
  ]

  const CX = 125, CY = 125, R = 100, IR = 78
  const GAP = 0.014
  const slices: { ticker: string; nom: string; color: string; val: number; pct: number; startA: number; endA: number }[] = []
  let cursor = -Math.PI / 2

  byTicker.forEach(({ ticker, nom, valeurCHF }, i) => {
    const pct = valeurCHF / totalVal
    const sweep = pct * 2 * Math.PI - GAP
    slices.push({ ticker, nom, color: colorPalette[i % colorPalette.length], val: valeurCHF, pct: pct * 100, startA: cursor + GAP / 2, endA: cursor + GAP / 2 + sweep })
    cursor += pct * 2 * Math.PI
  })

  function arc(cx: number, cy: number, r: number, ir: number, startA: number, endA: number, expand = 0) {
    const cos = Math.cos, sin = Math.sin
    const re = r + expand, ire = ir - expand
    const x1 = cx + re * cos(startA), y1 = cy + re * sin(startA)
    const x2 = cx + re * cos(endA),   y2 = cy + re * sin(endA)
    const x3 = cx + ire * cos(endA),  y3 = cy + ire * sin(endA)
    const x4 = cx + ire * cos(startA),y4 = cy + ire * sin(startA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${re} ${re} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ire} ${ire} 0 ${large} 0 ${x4} ${y4} Z`
  }

  const hovSlice = slices.find(s => s.ticker === hovered)
  const centerLabel = hovSlice
    ? { top: hovSlice.pct.toFixed(2) + '%', mid: hovSlice.nom, val: hovSlice.val.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CHF' }
    : { top: totalVal.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), mid: 'CHF total', val: null }

  return (
    <svg width="250" height="250" viewBox="0 0 250 250" style={{display:'block',margin:'0 auto'}}>
      {slices.map(s => (
        <path
          key={s.ticker}
          d={arc(CX, CY, R, IR, s.startA, s.endA, hovered === s.ticker ? 4 : 0)}
          fill={s.color}
          opacity={hovered && hovered !== s.ticker ? 0.35 : 1}
          style={{ transition: 'opacity 0.15s, d 0.15s', cursor: 'pointer' }}
          onMouseEnter={() => setHovered(s.ticker)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      <text x={CX} y={hovSlice ? CY - 14 : CY - 7} textAnchor="middle" fontSize="15" fontWeight="700"
        fill={hovSlice ? hovSlice.color : '#1B3050'} className="dark:fill-white font-mono" style={{transition:'y 0.15s'}}>
        {centerLabel.top}
      </text>
      <text x={CX} y={hovSlice ? CY + 5 : CY + 10} textAnchor="middle" fontSize="9.5" fill="#9E9A93" style={{transition:'y 0.15s'}}>
        {centerLabel.mid}
      </text>
      {hovSlice && <text x={CX} y={CY + 20} textAnchor="middle" fontSize="8.5" fill="#9E9A93" fontWeight="500">
        {centerLabel.val}
      </text>}
    </svg>
  )
}

// ─── Investor Profile ────────────────────────────────────────────────────────
const RF_RATE = 0.008
const MKT_ER  = 0.095
const BETA: Record<string, number> = {
  'ETF Oblig.': 0.05, 'ETF': 1.00, 'Actions': 1.25,
  'Matières premières': 0.55, 'Monnaies': 0.15, 'Crypto': 1.80,
}
const EXPECTED_RETURN: Record<string, number> = Object.fromEntries(
  Object.entries(BETA).map(([k, b]) => [k, RF_RATE + b * (MKT_ER - RF_RATE)])
)
const STRESS: { label: string; shocks: Record<string, number>; peakDate: string; troughDate: string }[] = [
  { label: 'Grande Crise Financière 2008', peakDate: '2007-10-09', troughDate: '2009-03-09', shocks: { 'ETF Oblig.': -0.03, 'ETF': -0.57, 'Actions': -0.75, 'Matières premières': -0.70, 'Monnaies': -0.10, 'Crypto': 0 } },
  { label: 'COVID-19 Mars 2020',           peakDate: '2020-02-19', troughDate: '2020-03-23', shocks: { 'ETF Oblig.':  0.05, 'ETF': -0.34, 'Actions': -0.45, 'Matières premières': -0.32, 'Monnaies':  0.00, 'Crypto': -0.50 } },
  { label: 'Choc taux 2022',               peakDate: '2021-12-31', troughDate: '2022-10-12', shocks: { 'ETF Oblig.': -0.20, 'ETF': -0.19, 'Actions': -0.25, 'Matières premières':  0.25, 'Monnaies':  0.08, 'Crypto': -0.75 } },
]
interface InvProfile {
  horizon: number
  loss: number
  liquidity: 'haute' | 'moyenne' | 'faible'
  objective: 'inflation' | 'modéré' | 'croissance' | 'agressif'
}

function normalRand(): number {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function pctile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(Math.floor(p / 100 * s.length), s.length - 1)]
}
function portfolioSigma(catWeights: Record<string, number>): number {
  let v = 0
  for (const ci of CATS) for (const cj of CATS)
    v += (catWeights[ci] ?? 0) * (catWeights[cj] ?? 0) * (CAT_VOL[ci] ?? 0.15) * (CAT_VOL[cj] ?? 0.15) * (CORR[ci]?.[cj] ?? 0)
  return Math.sqrt(Math.max(0, v))
}
function portfolioER(catWeights: Record<string, number>): number {
  return CATS.reduce((s, c) => s + (catWeights[c] ?? 0) * (EXPECTED_RETURN[c] ?? RF_RATE), 0)
}

// ─── Profile scoring (shared by InvProfileCard and InvestorProfileSection) ───
function deriveProfileType(profile: InvProfile) {
  let score = 0
  score += profile.horizon >= 20 ? 4 : profile.horizon >= 10 ? 3 : profile.horizon >= 5 ? 2 : 1
  score += profile.loss >= 40 ? 4 : profile.loss >= 25 ? 3 : profile.loss >= 15 ? 2 : 1
  score += profile.liquidity === 'faible' ? 3 : profile.liquidity === 'moyenne' ? 2 : 1
  score += profile.objective === 'agressif' ? 4 : profile.objective === 'croissance' ? 3 : profile.objective === 'modéré' ? 2 : 1
  if (score <= 5)  return { label: 'Prudent',   color: '#4A7EA5', desc: 'Capital preservation, faible risque.' }
  if (score <= 8)  return { label: 'Défensif',  color: '#4A8573', desc: 'Rendement régulier, volatilité limitée.' }
  if (score <= 11) return { label: 'Équilibré', color: '#C4952A', desc: 'Équilibre croissance / sécurité.' }
  if (score <= 14) return { label: 'Dynamique', color: '#B8722A', desc: 'Croissance prioritaire, tolérance modérée.' }
  return               { label: 'Agressif',  color: '#A85050', desc: 'Maximisation du rendement long terme.' }
}

function InvProfileCard({ profile }: { profile: InvProfile }) {
  const profileType = React.useMemo(() => deriveProfileType(profile), [profile])

  return (
    <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1B3050] dark:text-white">Profil d&apos;investisseur</h3>
        <a href="/profil" className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] text-xs font-medium text-[#14B8A6] hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 1L11 3L4 10H2V8L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
          Modifier
        </a>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <p className="font-semibold text-sm" style={{ color: profileType.color }}>{profileType.label}</p>
          <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">{profileType.desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#F5F3EF] dark:bg-[#1E2530] rounded-sm p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Horizon</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.horizon} ans</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1E2530] rounded-sm p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Tolérance perte</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">-{profile.loss} %</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1E2530] rounded-sm p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Besoin de liquidité</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.liquidity === 'haute' ? '1–3 ans' : profile.liquidity === 'moyenne' ? '3–7 ans' : '7+ ans'}</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1E2530] rounded-sm p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Objectif</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.objective === 'inflation' ? '~2–3 %/an' : profile.objective === 'modéré' ? '~5–7 %/an' : profile.objective === 'croissance' ? '~8–10 %/an' : '~10–15 %/an'}</p>
        </div>
      </div>
    </div>
  )
}

// ─── PnL par période (API snapshots) ─────────────────────────────────────────
function PnLBarChart({ positions }: { positions: PositionCalc[] }) {
  type TabId = 'annuel' | 'mensuel' | 'hebdomadaire' | 'journalier'
  const [tab, setTab] = React.useState<TabId>('mensuel')
  const tabs: { id: TabId; label: string }[] = [
    { id: 'annuel',        label: 'Annuel' },
    { id: 'mensuel',       label: 'Mensuel' },
    { id: 'hebdomadaire',  label: 'Hebdo' },
    { id: 'journalier',    label: 'Journalier' },
  ]

  // dailyPnl : date ISO → delta total CHF ce jour
  const [dailyPnl, setDailyPnl] = React.useState<Map<string, number>>(new Map())
  const [loading, setLoading]   = React.useState(true)
  const [hovered, setHovered]   = React.useState<number | null>(null)
  const [unit, setUnit]       = React.useState<'CHF' | 'PCT'>('CHF')

  // Clé stable : relance l'effet si une position est ajoutée/supprimée
  // OU si son gain réalisé change (position fermée, prixVente renseigné)
  const positionsKey = positions
    .map(p => `${p.id}|${p.quantite}|${p.prixAchat.toFixed(4)}|${(p.prixVente ?? 0).toFixed(4)}`)
    .sort().join(',')

  React.useEffect(() => {
    if (positions.length === 0) { setLoading(false); return }
    setLoading(true)

    // gainCHF intègre déjà le FX → pas besoin de fetcher les paires FX séparément
    const tickers = [...new Set(positions.map(p => p.ticker.toUpperCase()))]

    fetchHistory(tickers.join(','), false, '1day').then(hist => {
      const map = new Map<string, number>()

      for (const p of positions) {
        // Lookup insensible à la casse pour correspondre aux clés uppercase de l'API
        const ph = hist[p.ticker.toUpperCase()] ?? hist[p.ticker]
        if (!ph || ph.dates.length < 2) continue

        const buyDate  = p.dateAchat.slice(0, 10)
        const sellDate = p.dateVente ? p.dateVente.slice(0, 10) : '9999-12-31'

        // ── Collecter les deltas journaliers dans la fenêtre de détention ──
        const dayDeltas: { date: string; delta: number }[] = []
        let totalHistDelta = 0

        for (let i = 1; i < ph.dates.length; i++) {
          const date = ph.dates[i]
          if (date < buyDate || date > sellDate) continue
          const d = ph.closes[i] - ph.closes[i - 1]
          dayDeltas.push({ date, delta: d })
          totalHistDelta += d
        }

        if (dayDeltas.length === 0) continue

        // ── Distribuer gainCHF proportionnellement aux deltas de prix ──────
        // Garantit que Σ contributions = p.gainCHF exactement
        if (Math.abs(totalHistDelta) < 1e-10) {
          // Prix quasi-flat : répartir uniformément
          const share = p.gainCHF / dayDeltas.length
          for (const { date } of dayDeltas) map.set(date, (map.get(date) ?? 0) + share)
        } else {
          for (const { date, delta } of dayDeltas) {
            const contribution = (delta / totalHistDelta) * p.gainCHF
            map.set(date, (map.get(date) ?? 0) + contribution)
          }
        }
      }

      setDailyPnl(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey])

  // ── Calcul des entrées selon l'onglet ─────────────────────────────────────
  const data = React.useMemo(() => {
    const getISOWeek = (d: Date) => {
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
      const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
      return Math.ceil(((tmp.getTime() - ys.getTime()) / 86400000 + 1) / 7)
    }

    type Entry = { label: string; shortLabel: string; gain: number }
    let entries: Entry[] = []

    if (tab === 'annuel') {
      const byYear = new Map<number, number>()
      dailyPnl.forEach((v, date) => {
        const y = parseInt(date.slice(0, 4))
        byYear.set(y, (byYear.get(y) ?? 0) + v)
      })
      const currentYear = new Date().getFullYear()
      // Toujours au moins 7 années : année actuelle + 6 précédentes
      const minYear = Math.min(currentYear - 6, ...Array.from(byYear.keys()))
      const allYears: number[] = []
      for (let y = minYear; y <= currentYear; y++) allYears.push(y)
      entries = allYears.map(y => ({ label: String(y), shortLabel: String(y), gain: byYear.get(y) ?? 0 }))

    } else if (tab === 'mensuel') {
      const MONTH_LBL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
      const byMonth = new Array(12).fill(0)
      dailyPnl.forEach((v, date) => { byMonth[parseInt(date.slice(5, 7)) - 1] += v })
      entries = MONTH_LBL.map((lbl, i) => ({ label: lbl, shortLabel: lbl, gain: byMonth[i] }))

    } else if (tab === 'hebdomadaire') {
      const byWeek = new Array(53).fill(0)
      dailyPnl.forEach((v, date) => {
        const w = getISOWeek(new Date(date))
        if (w >= 1 && w <= 52) byWeek[w] += v
      })
      entries = Array.from({ length: 52 }, (_, i) => ({
        label: `Semaine ${i + 1}`, shortLabel: `S${i + 1}`, gain: byWeek[i + 1]
      }))

    } else {
      const DAY_LBL = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
      const byDay = new Array(7).fill(0)
      dailyPnl.forEach((v, date) => {
        const dow = new Date(date).getDay() // 0=dim, 6=sam
        // Lun=0 Mar=1 Mer=2 Jeu=3 Ven=4 Sam=5 Dim=6
        const idx = dow === 0 ? 6 : dow - 1
        if (idx >= 0 && idx < 7) byDay[idx] += v
      })
      entries = DAY_LBL.map((lbl, i) => ({ label: lbl, shortLabel: lbl, gain: byDay[i] }))
    }

    const maxAbs = Math.max(...entries.map(e => Math.abs(e.gain)), 1)
    const total  = entries.reduce((s, e) => s + e.gain, 0)
    const totalCost = positions.filter(p => !p.dateVente).reduce((s, p) => s + p.coutCHF, 0)
    return { entries, maxAbs, total, totalPct: totalCost > 0 ? (total / totalCost) * 100 : 0 }
  }, [dailyPnl, tab, positions])


  const totalCostOpen = positions.filter(p => !p.dateVente).reduce((s, p) => s + p.coutCHF, 0)

  /* Valeur affichée dans l’en-tête */
  const summaryGain    = hovered !== null && data.entries[hovered] ? data.entries[hovered].gain : data.total
  const summaryLbl     = hovered !== null && data.entries[hovered] ? data.entries[hovered].label : null
  const summaryIsPos   = summaryGain >= 0
  const summaryPct     = totalCostOpen > 0 ? (summaryGain / totalCostOpen) * 100 : 0

  const fmtChf = (n: number) => {
    const abs = Math.abs(n)
    const s = abs >= 10000 ? (abs / 1000).toFixed(1) + 'k' : abs.toFixed(0)
    return (n >= 0 ? '+' : '−') + 'CHF ' + s
  }
  const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  return (
    <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <h2 className="text-base font-bold text-[#1B3050] dark:text-white tracking-tight">PnL par période</h2>
        {/* Toggle CHF / % */}
        <div className="flex items-center rounded-md border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden text-[11px] font-semibold">
          <button
            onClick={() => setUnit('CHF')}
            className={`px-2.5 py-1 transition-colors ${unit === 'CHF' ? 'bg-[#1B3050] dark:bg-[#2A3A50] text-white' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'}`}>
            CHF
          </button>
          <button
            onClick={() => setUnit('PCT')}
            className={`px-2.5 py-1 transition-colors ${unit === 'PCT' ? 'bg-[#1B3050] dark:bg-[#2A3A50] text-white' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'}`}>
            %
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center px-5 pt-2 pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setHovered(null) }}
            className={`relative px-2 py-1.5 text-[11px] font-semibold transition-colors mr-0.5
              ${tab === t.id ? 'text-[#1B3050] dark:text-white' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'}`}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B3050] dark:bg-white rounded-full" />}
          </button>
        ))}
      </div>
      <div className="h-px bg-[#DDD9D1] dark:bg-[#253040] mx-5 mt-2 mb-0" />

      {/* Résumé haut gauche */}
      <div className="flex items-center gap-1.5 px-5 pt-2 pb-0 min-h-[20px]">
        {!loading && summaryLbl && (
          <>
            <span className="text-[11px] text-[#9E9A93]">{summaryLbl}</span>
            <span className={`text-[11px] font-semibold ${summaryIsPos ? 'text-[#14B8A6]' : 'text-[#EF4444]'}`}>
              {unit === 'PCT' ? fmtPct(summaryPct) : fmtChf(summaryGain)}
            </span>
          </>
        )}
      </div>

      {/* Graphique */}
      <div className="px-5 pt-3 pb-1">
        {(() => {
          const CHART_H = 80
          const HALF    = CHART_H / 2
          const n       = data.entries.length
          const GAP_MIN = 3
          const MAX_BAR = tab === 'annuel'
            ? (n <= 12 ? 20 : Math.max(6, Math.floor((480 - GAP_MIN * (n - 1)) / n)))
            : n <= 12 ? 20 : n <= 20 ? 8 : 9
          const svgW    = 480
          const barW    = Math.min(MAX_BAR, Math.max(2, Math.floor((svgW - GAP_MIN * (n - 1)) / n)))
          const GAP     = n > 1 ? Math.max(GAP_MIN, Math.floor((svgW - barW * n) / (n - 1))) : 0
          const usedW   = barW * n + GAP * (n - 1)
          const ox      = Math.round((svgW - usedW) / 2)

          return (
            <svg viewBox={`0 0 ${svgW} ${CHART_H}`} width="100%"
              style={{ display: 'block', overflow: 'visible' }}
              onMouseLeave={() => setHovered(null)}>

              {/* Ligne zéro */}
              <line x1={ox} y1={HALF} x2={ox + usedW} y2={HALF}
                stroke="#C8C4BC" strokeWidth="0.6" />

              {loading
                ? Array.from({ length: 12 }, (_, i) => {
                    const lox = Math.round((svgW - 12 * (MAX_BAR + GAP_MIN)) / 2)
                    return (
                      <rect key={i} x={lox + i * (MAX_BAR + GAP_MIN)} y={HALF - 3} width={MAX_BAR} height={6} rx={1.5}
                        fill="#DDD9D1" opacity={0.35} />
                    )
                  })
                : data.entries.map((e, idx) => {
                    const val    = unit === 'PCT' && totalCostOpen > 0 ? (e.gain / totalCostOpen) * 100 : e.gain
                    const maxA   = unit === 'PCT' && totalCostOpen > 0
                      ? Math.max(...data.entries.map(en => Math.abs(en.gain / totalCostOpen * 100)), 0.001)
                      : data.maxAbs
                    const isPos  = val >= 0
                    const isHov  = hovered === idx
                    const ratio  = Math.abs(val) / maxA
                    const bH     = Math.max(ratio * (HALF - 4), val !== 0 ? 2 : 0)
                    const x      = ox + idx * (barW + GAP)
                    const y      = isPos ? HALF - bH : HALF
                    const color  = isPos ? '#14B8A6' : '#EF4444'
                    return (
                      <g key={idx} style={{ cursor: 'pointer' }} onMouseEnter={() => setHovered(idx)}>
                        {/* Zone de survol */}
                        <rect x={x - 2} y={0} width={barW + 4} height={CHART_H} fill="transparent" />
                        {/* Barre */}
                        <rect x={x} y={y} width={barW} height={Math.max(bH, 2)} rx={1} fill={color}
                          opacity={hovered !== null && !isHov ? 0.3 : 1}
                          style={{ transition: 'opacity 0.12s' }} />

                      </g>
                    )
                  })
              }
            </svg>
          )
        })()}
      </div>


    </div>
  )
}


function InvestorProfileSection({
  data, profile,
}: {
  data: PositionCalc[]
  profile: InvProfile
}) {
  const [tab, setTab] = React.useState<'stats' | 'montecarlo' | 'stress' | 'frontier' | 'historique'>('stats')
  const [tip, setTip] = React.useState<string | null>(null)
  const [expandedFrontierTickers, setExpandedFrontierTickers] = React.useState<Set<string>>(new Set())
  const [showFX, setShowFX] = React.useState(false)
  const [longMode, setLongMode] = React.useState(false)

  // ── Positions ouvertes nettes (FIFO) — même logique que l'onglet Positions ──
  // Exclut les positions clôturées (dateVente) et tient compte des réductions
  // (quantité nette = lots longs − lots de vente). Une entrée par ticker.
  const netData = React.useMemo(() => {
    const byTicker: Record<string, PositionCalc[]> = {}
    for (const p of data) {
      if (p.dateVente) continue
      const k = p.ticker.toUpperCase();
      (byTicker[k] ??= []).push(p)
    }
    const result: PositionCalc[] = []
    for (const lots of Object.values(byTicker)) {
      const netQty = lots.reduce((s, p) => s + p.quantite, 0)
      if (netQty <= 0) continue
      const ref = lots.find(p => p.quantite > 0) ?? lots[0]
      const netValCHF = netQty * ref.prixActuel * ref.tauxActuelCHF
      const netCoutCHF = lots.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
      result.push({ ...ref, quantite: netQty, valeurCHF: netValCHF, coutCHF: netCoutCHF, gainCHF: netValCHF - netCoutCHF })
    }
    return result
  }, [data])

  const hasPositions = netData.length > 0
  const total = netData.reduce((s, p) => s + p.valeurCHF, 0)

  // ── Poids par catégorie ──
  const catWeights = React.useMemo(() => {
    const w: Record<string, number> = {}
    if (total <= 0) return w
    for (const p of netData) w[p.categorie] = (w[p.categorie] ?? 0) + p.valeurCHF / total
    return w
  }, [netData, total])

  // ── Métriques CAPM (fallback) ──
  const capmSigma = React.useMemo(() => portfolioSigma(catWeights), [catWeights])
  const capmER    = React.useMemo(() => portfolioER(catWeights), [catWeights])

  // ── Statistiques historiques réelles ──
  const [histStats, setHistStats] = React.useState<{
    er: number; sigma: number; periodStart: string; periodEnd: string
    yearsCount: number
    excluded: {nom: string; ticker: string; years: number}[]
    reduced:  {nom: string; ticker: string; years: number}[]
    optWeights: { ticker: string; nom: string; wCurrent: number; wOptimal: number; wMinVol: number; erAsset: number; sigmaAsset: number }[]
    optSharpe: number; optMinVolSigma: number; curSharpe: number
    // FX-adjusted
    fxAssetsFound: number
    erFX: number; sigmaFX: number; curSharpeFX: number
    optWeightsFX: { ticker: string; nom: string; wCurrent: number; wOptimal: number; wMinVol: number; erAsset: number; sigmaAsset: number }[]
    optSharpeFX: number; optMinVolSigmaFX: number
    covMatrix: number[][]; covMatrixFX: number[][]
    frontierPts: { r: number; s: number; sh: number }[]
    frontierPtsFX: { r: number; s: number; sh: number }[]
    realStress: { label: string; loss: number; isReal: boolean; coveredPct: number; peakDate: string; troughDate: string }[]
    maxDrawdown: number  // valeur négative, ex. -0.35 = drawdown max de 35 %
    isMonthly: boolean   // true = données mensuelles (historique max), false = journalier (10 ans)
  } | null>(null)
  const [histLoading, setHistLoading] = React.useState(false)

  const histKey = netData.map(p => `${p.ticker}:${Math.round(p.valeurCHF / (total || 1) * 20)}`).join(',')
  React.useEffect(() => {
    if (!hasPositions || netData.length === 0 || total <= 0) return
    setHistStats(null)
    setHistLoading(true)
    const tickers = [...new Set(netData.map(p => p.ticker.toUpperCase()))].join(',')
    const normFxDevise = (d: string) => { const u = d.toUpperCase(); return u === 'GBX' ? 'GBP' : u }
    const fxPairsNeeded = [...new Set(netData.filter(p => normFxDevise(p.devise) !== 'CHF').map(p => `${normFxDevise(p.devise)}CHF=X`))]
    const allTickersHist = [...tickers.split(','), ...fxPairsNeeded].join(',')
    fetchHistory(allTickersHist)
      .then((raw: Record<string, { dates: string[]; closes: number[] }>) => {
        const today = new Date()
        const MIN_YEARS_INCLUDE = longMode ? 10 : 3  // mensuel : exclure si < 10 ans (déjà couvert par le mode journalier), journalier : < 3 ans
        const annFactor = longMode ? 12 : 252  // 12 mois/an ou 252 jours/an
        const MAX_YEARS_WINDOW  = longMode ? 30 : 10    // mensuel : max 30 ans, journalier : 10 ans
        const tenYearsAgo = new Date(today); tenYearsAgo.setFullYear(today.getFullYear() - MAX_YEARS_WINDOW)
        const tenYearsAgoStr = tenYearsAgo.toISOString().slice(0, 10)

        const assetInfos = netData.map(p => {
          const hist = raw[p.ticker.toUpperCase()]
          if (!hist || hist.dates.length < 24) return { ...p, firstDate: '', years: 0, hist: null as null }
          const firstDate = hist.dates[0]
          const years = (today.getTime() - new Date(firstDate).getTime()) / (365.25 * 24 * 3600 * 1000)
          return { ...p, firstDate, years, hist }
        })
        const excluded = assetInfos
          .filter(a => a.hist !== null && a.years < MIN_YEARS_INCLUDE)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: Math.round(a.years * 10) / 10 }))
        const noData = assetInfos
          .filter(a => a.hist === null)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: 0 }))
        const included = assetInfos.filter(a => a.hist !== null && a.years >= MIN_YEARS_INCLUDE)
        if (included.length === 0) { setHistLoading(false); return }

        // commonStart = date la plus tardive parmi les actifs inclus
        const commonStart = included.reduce((mx, a) => a.firstDate > mx ? a.firstDate : mx, included[0].firstDate)
        // effectiveStart = on plafonne à 10 ans (si tous les actifs ont ≥ 10 ans, on prend tenYearsAgo)
        const effectiveStart = commonStart > tenYearsAgoStr ? commonStart : tenYearsAgoStr
        // Actifs qui réduisent la fenêtre en dessous de 10 ans (firstDate > tenYearsAgo)
        const reduced = included
          .filter(a => a.firstDate > tenYearsAgoStr)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: Math.round(a.years * 10) / 10 }))

        function dailyRets(dates: string[], closes: number[], from: string): number[] {
          const fd: number[] = []
          for (let i = 0; i < dates.length; i++) if (dates[i] >= from) fd.push(closes[i])
          return fd.slice(1).map((c, i) => c / fd[i] - 1)
        }
        function dailyRetsFX(dates: string[], closes: number[], fxDates: string[], fxCloses: number[], from: string): number[] {
          // Build carry-forward FX lookup (binary search)
          let carry = 0
          const fxSorted: { date: string; rate: number }[] = fxDates.map((d, i) => {
            if (fxCloses[i] > 0) carry = fxCloses[i]
            return { date: d, rate: carry }
          })
          const getFX = (d: string) => {
            let lo = 0, hi = fxSorted.length - 1, r = fxSorted[0]?.rate ?? 1
            while (lo <= hi) {
              const mid = (lo + hi) >> 1
              if (fxSorted[mid].date <= d) { r = fxSorted[mid].rate; lo = mid + 1 } else hi = mid - 1
            }
            return r
          }
          const filtDates: string[] = [], filtCloses: number[] = []
          for (let i = 0; i < dates.length; i++) {
            if (dates[i] >= from) { filtDates.push(dates[i]); filtCloses.push(closes[i]) }
          }
          return filtDates.slice(1).map((d, i) => {
            const rAsset = filtCloses[i + 1] / filtCloses[i] - 1
            const fxPrev = getFX(filtDates[i]), fxCurr = getFX(d)
            const rFX = fxPrev > 0 && fxCurr > 0 ? fxCurr / fxPrev - 1 : 0
            return (1 + rAsset) * (1 + rFX) - 1
          })
        }

        // ── Rééchantillonnage mensuel (mode long terme) ──
        function toMonthlyPrices(dates: string[], closes: number[]): { dates: string[]; closes: number[] } {
          const byMonth: Record<string, { date: string; close: number }> = {}
          for (let i = 0; i < dates.length; i++) {
            const key = dates[i].slice(0, 7) // YYYY-MM
            byMonth[key] = { date: dates[i], close: closes[i] } // dernier jour du mois
          }
          const keys = Object.keys(byMonth).sort()
          return { dates: keys.map(k => byMonth[k].date), closes: keys.map(k => byMonth[k].close) }
        }
        function monthlyRets(dates: string[], closes: number[], from: string): number[] {
          const m = toMonthlyPrices(dates, closes)
          const fd: number[] = []
          for (let i = 0; i < m.dates.length; i++) if (m.dates[i] >= from) fd.push(m.closes[i])
          return fd.slice(1).map((c, i) => c / fd[i] - 1)
        }
        function monthlyRetsFX(dates: string[], closes: number[], fxDates: string[], fxCloses: number[], from: string): number[] {
          const mAsset = toMonthlyPrices(dates, closes)
          const mFX    = toMonthlyPrices(fxDates, fxCloses)
          // Align by month key
          const fxByMonth: Record<string, number> = {}
          for (let i = 0; i < mFX.dates.length; i++) fxByMonth[mFX.dates[i].slice(0, 7)] = mFX.closes[i]
          const aD: string[] = [], aC: number[] = []
          let lastFX = 0
          for (let i = 0; i < mAsset.dates.length; i++) {
            if (mAsset.dates[i] >= from) {
              const mk = mAsset.dates[i].slice(0, 7)
              lastFX = fxByMonth[mk] ?? lastFX
              aD.push(mAsset.dates[i]); aC.push(mAsset.closes[i])
            }
          }
          const fxRates: number[] = aD.map(d => { const fx = fxByMonth[d.slice(0,7)]; return fx ?? lastFX })
          return aD.slice(1).map((_, i) => {
            const rAsset = aC[i+1] / aC[i] - 1
            const rFX = fxRates[i] > 0 && fxRates[i+1] > 0 ? fxRates[i+1] / fxRates[i] - 1 : 0
            return (1 + rAsset) * (1 + rFX) - 1
          })
        }
        const getRets    = longMode ? monthlyRets    : dailyRets
        const getRetsFX  = longMode ? monthlyRetsFX  : dailyRetsFX

        const inclTotal = included.reduce((s, a) => s + a.valeurCHF, 0)
        if (inclTotal <= 0) { setHistLoading(false); return }

        // ── Retours journaliers → E(R), σ, Sharpe, VaR/CVaR ──
        const assetRets = included.map(a => ({
          rets: getRets(a.hist!.dates, a.hist!.closes, effectiveStart),
          w: a.valeurCHF / inclTotal,
        }))
        let fxAssetsFound = 0
        const assetRetsFX = included.map(a => {
          const devNorm = a.devise.toUpperCase() === 'GBX' ? 'GBP' : a.devise.toUpperCase()
          if (devNorm === 'CHF') return { rets: getRets(a.hist!.dates, a.hist!.closes, effectiveStart), w: a.valeurCHF / inclTotal }
          const fxKey = `${devNorm}CHF=X`
          const fxHist = raw[fxKey]
          if (!fxHist) {
            return { rets: getRets(a.hist!.dates, a.hist!.closes, effectiveStart), w: a.valeurCHF / inclTotal }
          }
          fxAssetsFound++
          return { rets: getRetsFX(a.hist!.dates, a.hist!.closes, fxHist.dates, fxHist.closes, effectiveStart), w: a.valeurCHF / inclTotal }
        })
        const minLen = Math.min(...assetRets.map(a => a.rets.length))
        if (minLen < (longMode ? 12 : 60)) { setHistLoading(false); return }
        const portRets: number[] = []
        for (let t = 0; t < minLen; t++)
          portRets.push(assetRets.reduce((s, a) => s + a.w * (a.rets[t] ?? 0), 0))
        const mean = portRets.reduce((s, r) => s + r, 0) / portRets.length
        const erH  = mean * annFactor
        const varM = portRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (portRets.length - 1)
        const sigH = Math.sqrt(varM * annFactor)
        const curSharpe = sigH > 0 ? (erH - RF_RATE) / sigH : 0

        // FX-adjusted (journalier)
        const minLenFX = Math.min(...assetRetsFX.map(a => a.rets.length))
        const portRetsFX: number[] = []
        for (let t = 0; t < minLenFX; t++)
          portRetsFX.push(assetRetsFX.reduce((s, a) => s + a.w * (a.rets[t] ?? 0), 0))
        const meanFX = portRetsFX.length > 0 ? portRetsFX.reduce((s, r) => s + r, 0) / portRetsFX.length : 0
        const erFXH  = meanFX * annFactor
        const varMFX = portRetsFX.length > 1 ? portRetsFX.reduce((s, r) => s + (r - meanFX) ** 2, 0) / (portRetsFX.length - 1) : 0
        const sigFX  = Math.sqrt(varMFX * annFactor)
        const curSharpeFX = sigFX > 0 ? (erFXH - RF_RATE) / sigFX : 0

        // Per-asset stats (journaliers, cohérents avec les métriques principales)
        const assetStats = included.map((a, i) => {
          const rets = assetRets[i].rets.slice(0, minLen)
          const m = rets.length > 0 ? rets.reduce((s, r) => s + r, 0) / rets.length : 0
          const v = rets.length > 1 ? rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1) : 0
          return { ticker: a.ticker, nom: a.nom, wCurrent: assetRets[i].w, erAsset: m * annFactor, sigmaAsset: Math.sqrt(v * annFactor) }
        })
        const assetStatsFX = included.map((a, i) => {
          const rets = assetRetsFX[i].rets.slice(0, minLenFX)
          const m = rets.length > 0 ? rets.reduce((s, r) => s + r, 0) / rets.length : 0
          const v = rets.length > 1 ? rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1) : 0
          return { ticker: a.ticker, nom: a.nom, wCurrent: assetRetsFX[i].w, erAsset: m * annFactor, sigmaAsset: Math.sqrt(v * annFactor) }
        })

        // Matrices de covariance annualisées (frontière efficiente précise)
        const nA = assetRets.length
        const covMatrix: number[][] = Array.from({length: nA}, (_, i) =>
          Array.from({length: nA}, (_, j) => {
            const ri = assetRets[i].rets, rj = assetRets[j].rets
            const len = Math.min(ri.length, rj.length, minLen)
            if (len < 2) return i === j ? (assetStats[i].sigmaAsset ** 2) : 0
            let si = 0, sj = 0
            for (let t = 0; t < len; t++) { si += ri[t]; sj += rj[t] }
            const mi = si / len, mj = sj / len
            let cov = 0
            for (let t = 0; t < len; t++) cov += (ri[t] - mi) * (rj[t] - mj)
            return cov / (len - 1) * annFactor
          })
        )
        const covMatrixFX: number[][] = Array.from({length: nA}, (_, i) =>
          Array.from({length: nA}, (_, j) => {
            const ri = assetRetsFX[i].rets, rj = assetRetsFX[j].rets
            const len = Math.min(ri.length, rj.length, minLenFX)
            if (len < 2) return i === j ? (assetStatsFX[i].sigmaAsset ** 2) : 0
            let si = 0, sj = 0
            for (let t = 0; t < len; t++) { si += ri[t]; sj += rj[t] }
            const mi = si / len, mj = sj / len
            let cov = 0
            for (let t = 0; t < len; t++) cov += (ri[t] - mi) * (rj[t] - mj)
            return cov / (len - 1) * annFactor
          })
        )

        // PRNG déterministe (mulberry32) seedé sur la composition du portefeuille
        const portfolioSeed = included.reduce((acc, a) => {
          let h = 0
          for (let i = 0; i < a.ticker.length; i++) h = Math.imul(h ^ a.ticker.charCodeAt(i), 0x9e3779b9)
          return acc ^ (h + Math.round(a.valeurCHF * 100))
        }, 0x12345678)
        function makePrng(seed: number) {
          let s = seed | 0
          return () => {
            s = s + 0x6D2B79F5 | 0
            let t = Math.imul(s ^ s >>> 15, 1 | s)
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
            return ((t ^ t >>> 14) >>> 0) / 4294967296
          }
        }
        const rand = makePrng(portfolioSeed)
        const randFX = makePrng(portfolioSeed ^ 0xdeadbeef)

        // Monte Carlo journalier: max-Sharpe + min-vol + points frontière (5000 portefeuilles)
        const n = assetRets.length
        let bestSharpe = -Infinity, bestVolSigma = Infinity
        let bestW = assetRets.map(a => a.w)
        let minVolW = assetRets.map(a => a.w)
        const frontierPts: { r: number; s: number; sh: number }[] = []
        for (let s = 0; s < 5000; s++) {
          const rw = Array.from({ length: n }, () => -Math.log(rand() + 1e-12))
          const sum = rw.reduce((a, b) => a + b, 0)
          const w = rw.map(x => x / sum)
          const pr = Array.from({ length: minLen }, (_, t) => assetRets.reduce((acc, a, i) => acc + w[i] * a.rets[t], 0))
          const pm = pr.reduce((a, b) => a + b, 0) / pr.length
          const pv = pr.reduce((a, r) => a + (r - pm) ** 2, 0) / (pr.length - 1)
          const ps = Math.sqrt(pv * annFactor)
          const sharpeS = ps > 0 ? (pm * annFactor - RF_RATE) / ps : 0
          if (sharpeS > bestSharpe) { bestSharpe = sharpeS; bestW = w }
          if (ps < bestVolSigma) { bestVolSigma = ps; minVolW = w }
          frontierPts.push({ r: pm * annFactor, s: ps, sh: sharpeS })
        }
        const optWeights = assetStats.map((a, i) => ({ ...a, wOptimal: bestW[i], wMinVol: minVolW[i] }))

        // Monte Carlo FX journalier
        let bestSharpeFX = -Infinity, bestVolSigmaFX = Infinity
        let bestWFX = assetRetsFX.map(a => a.w)
        let minVolWFX = assetRetsFX.map(a => a.w)
        const frontierPtsFX: { r: number; s: number; sh: number }[] = []
        for (let s = 0; s < 5000; s++) {
          const rwFX = Array.from({ length: n }, () => -Math.log(randFX() + 1e-12))
          const sumW = rwFX.reduce((a, b) => a + b, 0)
          const w = rwFX.map(x => x / sumW)
          const pr = Array.from({ length: minLenFX }, (_, t) => assetRetsFX.reduce((acc, a, i) => acc + w[i] * a.rets[t], 0))
          const pm = pr.reduce((a, b) => a + b, 0) / pr.length
          const pv = pr.reduce((a, r) => a + (r - pm) ** 2, 0) / (pr.length - 1)
          const ps = Math.sqrt(pv * annFactor)
          const sharpeS = ps > 0 ? (pm * annFactor - RF_RATE) / ps : 0
          if (sharpeS > bestSharpeFX) { bestSharpeFX = sharpeS; bestWFX = w }
          if (ps < bestVolSigmaFX) { bestVolSigmaFX = ps; minVolWFX = w }
          frontierPtsFX.push({ r: pm * annFactor, s: ps, sh: sharpeS })
        }
        const optWeightsFX = assetStatsFX.map((a, i) => ({ ...a, wOptimal: bestWFX[i], wMinVol: minVolWFX[i] }))

        // ── Max drawdown historique du portefeuille (converti en CHF) ──
        // On utilise portRetsFX (rendements ajustés change) pour que les fluctuations
        // USD/EUR → CHF soient prises en compte — sans ça le drawdown est sous-estimé.
        // Si aucun actif étranger (fxAssetsFound=0), portRetsFX === portRets.
        const ddRets = minLenFX >= 60 ? portRetsFX : portRets
        let cumVal = 1, peakVal = 1, mdd = 0
        for (const r of ddRets) {
          cumVal *= (1 + r)
          if (cumVal > peakVal) peakVal = cumVal
          const dd = (cumVal - peakVal) / peakVal
          if (dd < mdd) mdd = dd
        }
        const maxDrawdown = mdd  // ≤ 0, ex. -0.35

        // ── Stress tests avec données réelles ──
        function priceOnOrBefore(dates: string[], closes: number[], target: string): number | null {
          let lo = 0, hi = dates.length - 1, res: number | null = null
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (dates[mid] <= target) { res = closes[mid]; lo = mid + 1 } else hi = mid - 1
          }
          return res
        }
        const realStress = STRESS.map(sc => {
          // Si la crise précède la fenêtre d'analyse → non couverte
          if (sc.peakDate < effectiveStart) {
            return { label: sc.label, loss: 0, isReal: false, coveredPct: 0, peakDate: sc.peakDate, troughDate: sc.troughDate }
          }
          let weightedLoss = 0, totalWeightCovered = 0
          for (const a of included) {
            const peakPrice   = priceOnOrBefore(a.hist!.dates, a.hist!.closes, sc.peakDate)
            const troughPrice = priceOnOrBefore(a.hist!.dates, a.hist!.closes, sc.troughDate)
            if (peakPrice == null || troughPrice == null || peakPrice === 0) continue
            weightedLoss      += a.valeurCHF * ((troughPrice - peakPrice) / peakPrice)
            totalWeightCovered += a.valeurCHF
          }
          const coveredPct = inclTotal > 0 ? totalWeightCovered / inclTotal : 0
          const loss = inclTotal > 0 ? weightedLoss / inclTotal : 0
          // N'afficher que si 100 % des actifs analysés sont couverts
          return { label: sc.label, loss, isReal: coveredPct >= 0.999, coveredPct, peakDate: sc.peakDate, troughDate: sc.troughDate }
        })

        setHistStats({
          er: erH, sigma: sigH,
          periodStart: effectiveStart,
          periodEnd: today.toISOString().slice(0, 10),
          yearsCount: longMode ? portRets.length / 12 : portRets.length / 252,
          excluded: [...excluded, ...noData], reduced,
          optWeights, optSharpe: bestSharpe, optMinVolSigma: bestVolSigma, curSharpe,
          fxAssetsFound, erFX: erFXH, sigmaFX: sigFX, curSharpeFX,
          optWeightsFX, optSharpeFX: bestSharpeFX, optMinVolSigmaFX: bestVolSigmaFX,
          covMatrix, covMatrixFX,
          frontierPts, frontierPtsFX,
          realStress,
          maxDrawdown,
          isMonthly: longMode,
        })
      })
      .catch(() => {})
      .finally(() => setHistLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histKey, hasPositions, longMode])

  // ── Métriques finales (historiques si dispo, CAPM sinon) ──
  const er      = histStats?.er    ?? capmER
  const sigma   = histStats?.sigma ?? capmSigma
  const erFX    = histStats?.erFX    ?? er
  const sigmaFX = histStats?.sigmaFX ?? sigma
  const sharpe  = sigma > 0 ? (er - RF_RATE) / sigma : 0
  // Valeurs effectives selon le toggle FX (utilisées pour MC, stress, frontière)
  const erEff    = showFX && histStats ? erFX    : er
  const sigmaEff = showFX && histStats ? sigmaFX : sigma
  const var95   = er - 1.645 * sigma
  const cvar95  = er - 2.063 * sigma
  const hhi     = Object.values(catWeights).reduce((s, w) => s + w * w, 0)
  const effN    = hhi > 0 ? 1 / hhi : 0
  const var95m  = er / 12 - 1.645 * sigma / Math.sqrt(12)

  // ── Type de profil dérivé ──
  const profileType = React.useMemo(() => deriveProfileType(profile), [profile])

  // ── Monte Carlo ──
  const mcPaths = React.useMemo(() => {
    if (!hasPositions || sigmaEff === 0) return []
    const N = 2000, dt = 1 / 12, steps = 20 * 12
    const paths: number[][] = []
    for (let i = 0; i < N; i++) {
      const path = [1.0]
      for (let t = 0; t < steps; t++) {
        const prev = path[path.length - 1]
        path.push(prev * Math.exp((erEff - sigmaEff * sigmaEff / 2) * dt + sigmaEff * Math.sqrt(dt) * normalRand()))
      }
      paths.push(path)
    }
    return paths
  }, [hasPositions, sigmaEff, erEff, profile.horizon])

  const mcBands = React.useMemo(() => {
    if (mcPaths.length === 0) return []
    const steps = 20 * 12 + 1
    return Array.from({ length: steps }, (_, t) => {
      const vals = mcPaths.map(p => p[t])
      return {
        p5:  pctile(vals, 5),
        p25: pctile(vals, 25),
        p50: pctile(vals, 50),
        p75: pctile(vals, 75),
        p95: pctile(vals, 95),
      }
    })
  }, [mcPaths, profile.horizon])

  // ── Stress tests ──
  const stressResults = React.useMemo(() => {
    if (!hasPositions) return []
    // Données réelles disponibles : n'afficher que les crises couvertes
    if (histStats?.realStress) {
      return histStats.realStress
        .filter(sc => sc.isReal)
        .map(sc => {
          const recovery = sc.loss < 0 ? Math.ceil(Math.log(1 / (1 + sc.loss)) / Math.log(1 + erEff)) : 0
          return { ...sc, recovery }
        })
    }
    // Fallback CAPM (données historiques pas encore chargées) : on affiche tout
    return STRESS.map(sc => {
      const loss = CATS.reduce((s, c) => s + (catWeights[c] ?? 0) * (sc.shocks[c] ?? 0), 0)
      const recovery = loss < 0 ? Math.ceil(Math.log(1 / (1 + loss)) / Math.log(1 + erEff)) : 0
      return { ...sc, loss, recovery, coveredPct: 0 }
    })
  }, [catWeights, hasPositions, erEff, histStats])

  // ── Score du portefeuille ──
  const scoreResult = React.useMemo(() => {
    if (!hasPositions || sigma === 0) return null

    const h = profile.horizon

    // ── Poids dynamiques selon l'horizon ──
    // Court terme : liquidité et protection des pertes priment
    // Long terme : rendement et diversification réelle priment
    const wts = h >= 15
      ? { q1: 0.30, q2: 0.20, q3: 0.15, q4: 0.35 }
      : h >= 8
      ? { q1: 0.25, q2: 0.25, q3: 0.25, q4: 0.25 }
      : { q1: 0.20, q2: 0.30, q3: 0.35, q4: 0.15 }

    // ── Q1 — Horizon : volatilité + diversification ajustée corrélations ──
    // Volatilité (0-100) : seuils plus permissifs sur long terme
    const sigScore = h >= 15
      ? sigma <= 0.30 ? 100 : sigma <= 0.45 ? 75 : sigma <= 0.60 ? 40 : 15
      : h >= 8
      ? sigma <= 0.18 ? 100 : sigma <= 0.28 ? 65 : sigma <= 0.40 ? 30 : 10
      : sigma <= 0.08 ? 100 : sigma <= 0.15 ? 60 : sigma <= 0.22 ? 25 : 0

    // Diversification Ratio (DR) ajusté corrélations, si covMatrix disponible
    // DR = Σ(wᵢ × σᵢ) / σp — vaut 1 si tous corrélés, √n si décorrélés à poids égaux
    let drScore: number
    let dr: number | null = null
    if (histStats && histStats.optWeights.length > 1 && histStats.sigma > 0) {
      dr = histStats.optWeights.reduce((s, a) => s + a.wCurrent * a.sigmaAsset, 0) / histStats.sigma
      const drMax = Math.sqrt(histStats.optWeights.length)
      const drNorm = Math.min(1, Math.max(0, (dr - 1) / Math.max(0.5, drMax - 1)))
      drScore = Math.round(drNorm * 100)
      // Pénalité si DR < 1.15 (quasi aucun bénéfice de diversification) sur horizon long
      if (h >= 15 && dr < 1.15) drScore = Math.min(drScore, 25)
    } else {
      // Fallback sur N effectif si pas de données historiques
      drScore = h >= 15
        ? effN >= 8 ? 100 : effN >= 5 ? 70 : effN >= 3 ? 40 : 10
        : h >= 8
        ? effN >= 5 ? 100 : effN >= 3 ? 70 : effN >= 2 ? 40 : 15
        : effN >= 3 ? 100 : effN >= 2 ? 70 : 40
    }
    const q1 = Math.round(sigScore * 0.48 + drScore * 0.52)

    // ── Q2 — Pertes : VaR annuelle + drawdown max historique (ou CVaR si pas de données) ──
    const tol = profile.loss / 100
    const varLoss = Math.max(0, -var95)
    const varScore = varLoss <= tol * 0.7 ? 100 : varLoss <= tol ? 80 : varLoss <= tol * 1.3 ? 40 : varLoss <= tol * 1.6 ? 15 : 0

    let lossScore2: number
    const maxDD = histStats?.maxDrawdown ?? null
    if (maxDD !== null) {
      // Drawdown max historique (perte réelle la pire observée)
      // Tolérance implicite sur drawdown = 2× la tolérance annuelle déclarée (car drawdown ≫ VaR)
      const dd = Math.abs(maxDD)
      const ddTol = tol * 2.0
      lossScore2 = dd <= ddTol * 0.6 ? 100 : dd <= ddTol ? 80 : dd <= ddTol * 1.4 ? 40 : dd <= ddTol * 1.8 ? 15 : 0
    } else {
      // Fallback CVaR si pas de données historiques
      const cvarLoss = Math.max(0, -cvar95)
      lossScore2 = cvarLoss <= tol ? 100 : cvarLoss <= tol * 1.3 ? 65 : cvarLoss <= tol * 1.6 ? 25 : 0
    }
    const q2 = Math.round(varScore * 0.55 + lossScore2 * 0.45)

    // ── Q3 — Liquidité : VaR mensuelle + concentration HHI ──
    const varMLoss = Math.max(0, -var95m)
    const liq = profile.liquidity
    const varMScore = liq === 'haute'
      ? varMLoss <= 0.025 ? 100 : varMLoss <= 0.05 ? 65 : varMLoss <= 0.08 ? 25 : 0
      : liq === 'moyenne'
      ? varMLoss <= 0.05  ? 100 : varMLoss <= 0.08 ? 65 : varMLoss <= 0.12 ? 25 : 0
      : varMLoss <= 0.08  ? 100 : varMLoss <= 0.15 ? 65 : varMLoss <= 0.25 ? 30 : 10
    const effNScore = liq === 'haute'
      ? effN >= 6.5 ? 100 : effN >= 4 ? 60 : effN >= 2.5 ? 20 : 0
      : liq === 'moyenne'
      ? effN >= 4 ? 100 : effN >= 2.5 ? 60 : effN >= 1.6 ? 25 : 10
      : effN >= 2.5 ? 100 : effN >= 1.6 ? 70 : 40
    const q3 = Math.round(varMScore * 0.60 + effNScore * 0.40)

    // ── Q4 — Rendement : E(Rp) vs cible + Sharpe (efficience risque/rendement) ──
    const target = ({ 'inflation': 0.03, 'modéré': 0.06, 'croissance': 0.09, 'agressif': 0.13 } as Record<string,number>)[profile.objective] ?? 0.06
    const retScore = er >= target ? 100 : er >= target * 0.75 ? 72 : er >= target * 0.5 ? 40 : er >= 0 ? 20 : 8
    const shScore  = sharpe >= 1 ? 100 : sharpe >= 0.5 ? 70 : sharpe >= 0.2 ? 40 : sharpe >= 0 ? 15 : 0
    const q4 = Math.round(retScore * 0.65 + shScore * 0.35)

    const total = Math.min(100, Math.round(wts.q1 * q1 + wts.q2 * q2 + wts.q3 * q3 + wts.q4 * q4))

    return {
      total, q1, q2, q3, q4, wts,
      sigScore, drScore, varScore, lossScore2, varMScore, effNScore, retScore, shScore,
      tol, varLoss, target, dr, maxDD,
    }
  }, [hasPositions, sigma, er, sharpe, hhi, effN, var95, cvar95, var95m, profile, histStats])

  const portfolioScore = scoreResult?.total ?? null

  // ── Recommandations ──
  const recommendations = React.useMemo(() => {
    if (!scoreResult) return []
    const recs: {icon: string; text: string; severity: 'high' | 'medium' | 'low'}[] = []
    const { varScore, lossScore2, shScore, drScore, retScore, varMScore, effNScore,
            tol, varLoss, target, dr, maxDD, total: scoreTotal } = scoreResult
    const h = profile.horizon
    const actionsW = catWeights['Actions'] ?? 0
    const obligW   = (catWeights['ETF Oblig.'] ?? 0) + (catWeights['Obligations'] ?? 0)

    // ── 0. Rendement négatif (alerte absolue avant tout) ──
    if (er < 0)
      recs.push({ icon: '🚨', severity: 'high',
        text: `Rendement attendu négatif (${(er*100).toFixed(1)} %) : votre portefeuille est susceptible de perdre de la valeur en termes réels. Revoyez intégralement votre allocation.` })

    // ── 1. Rendement vs objectif ──
    else if (retScore <= 20)
      recs.push({ icon: '📉', severity: 'high',
        text: `Rendement attendu (${(er*100).toFixed(1)} %) insuffisant pour votre objectif (${(target*100).toFixed(0)} %). Envisagez des actifs plus dynamiques (actions, ETF croissance).` })
    else if (retScore <= 40)
      recs.push({ icon: '📊', severity: 'low',
        text: `Rendement en dessous de votre objectif (${(target*100).toFixed(0)} %). Une légère réorientation vers des actifs de croissance pourrait suffire.` })

    // ── 2. VaR vs tolérance ──
    if (varScore === 0)
      recs.push({ icon: '⚠️', severity: 'high',
        text: `Perte probable (VaR ${(varLoss*100).toFixed(1)} %, soit +${((varLoss - tol)*100).toFixed(1)} pt au-dessus de votre seuil). Réduisez l'exposition aux actifs volatils.` })
    else if (varScore <= 40)
      recs.push({ icon: '⚠️', severity: 'medium',
        text: `Perte probable (VaR ${(varLoss*100).toFixed(1)} %) dépasse votre tolérance de ${(tol*100).toFixed(0)} % (+${((varLoss - tol)*100).toFixed(1)} pt). Rééquilibrage conseillé.` })

    // ── 3. Drawdown historique / CVaR ──
    if (maxDD !== null && lossScore2 <= 15)
      recs.push({ icon: '🔥', severity: 'high',
        text: `Pire baisse historique (${(Math.abs(maxDD)*100).toFixed(1)} %) très supérieure à votre tolérance (${(tol*100).toFixed(0)} %). Augmentez les actifs défensifs (obligations, or).` })
    else if (maxDD === null && lossScore2 <= 25)
      recs.push({ icon: '🔥', severity: 'high',
        text: `En scénario de crise (CVaR), la perte potentielle est dangereuse par rapport à votre profil. Augmentez les actifs défensifs (obligations, or).` })

    // ── 4. Sharpe — texte personnalisé selon cause ──
    if (shScore <= 15) {
      const cause = er < 0.03
        ? `Le rendement attendu (${(er*100).toFixed(1)} %) est trop faible. Cherchez des actifs plus rémunérateurs.`
        : sigma > 0.25
        ? `La volatilité (${(sigma*100).toFixed(1)} %) est trop élevée par rapport au gain. Réduisez les positions très volatiles.`
        : `Le couple rendement/risque est sous-optimal. Consultez la Frontière efficiente pour un meilleur équilibre.`
      recs.push({ icon: '⚖️', severity: 'medium',
        text: `Ratio de Sharpe faible (${sharpe.toFixed(2)}). ${cause}` })
    }

    // ── 5. Diversification / corrélations ──
    if (drScore <= 20 && h >= 10)
      recs.push({ icon: '🗂️', severity: 'high',
        text: dr !== null
          ? `Vos actifs sont fortement corrélés (DR ${dr.toFixed(2)}) : ils baissent ensemble en cas de crise. Ajoutez des classes d'actifs décorrélées (obligations, or, immobilier).`
          : `Diversification insuffisante (N eff. ${effN.toFixed(1)}) pour un horizon de ${h} ans. Ajoutez des classes d'actifs décorrélées (ETF monde, obligations).` })
    else if (drScore <= 50 && h >= 15)
      recs.push({ icon: '🗂️', severity: 'medium',
        text: `Diversification à améliorer pour votre horizon long (${h} ans). Les actifs restent trop corrélés entre eux.` })

    // ── 6. Liquidité mensuelle ──
    if (varMScore === 0 && profile.liquidity === 'haute')
      recs.push({ icon: '💧', severity: 'high',
        text: `Volatilité mensuelle élevée incompatible avec votre besoin de liquidité haute. Augmentez la part de fonds monétaires ou d'obligations courtes.` })
    else if (varMScore <= 25 && profile.liquidity === 'moyenne')
      recs.push({ icon: '💧', severity: 'medium',
        text: `Volatilité mensuelle élevée pour un besoin de liquidité à moyen terme. Envisagez une part plus importante d'obligations courtes ou de monétaire.` })
    else if (effNScore <= 20 && profile.liquidity !== 'faible')
      recs.push({ icon: '🔒', severity: 'medium',
        text: `Portefeuille concentré (N effectif ${effN.toFixed(1)}) : certains actifs peuvent être difficiles à liquider rapidement. Diversifiez ou réduisez les positions illiquides.` })

    // ── 7. Concentration extrême (N effectif < 1.5 — position quasi unique) ──
    if (effN < 1.5)
      recs.push({ icon: '🎯', severity: 'high',
        text: `Portefeuille quasi mono-position (N eff. ${effN.toFixed(1)}) : la totalité de votre capital dépend d'un seul actif. Diversifiez de toute urgence.` })

    // ── 8. Tout-actions sur horizon court ──
    if (actionsW > 0.75 && h <= 5 && obligW < 0.15)
      recs.push({ icon: '📅', severity: 'high',
        text: `${(actionsW*100).toFixed(0)} % d'actions pour un horizon de ${h} an${h > 1 ? 's' : ''} : le risque de marché est trop élevé à court terme. Intégrez des obligations ou du monétaire (au moins 20 %).` })
    else if (actionsW > 0.60 && h <= 3 && obligW < 0.20)
      recs.push({ icon: '📅', severity: 'medium',
        text: `Exposition actions élevée (${(actionsW*100).toFixed(0)} %) pour un horizon très court (${h} an${h > 1 ? 's' : ''}). Envisagez de sécuriser une partie du capital.` })

    // ── 9. Profil agressif mais portefeuille trop conservateur ──
    if ((profile.objective === 'agressif' || profile.objective === 'croissance') && sigma < 0.08 && er < target * 0.6)
      recs.push({ icon: '🐢', severity: 'medium',
        text: `Votre profil est ${profile.objective} mais votre portefeuille est peu volatile (${(sigma*100).toFixed(1)} %) et sous-performe votre cible (${(er*100).toFixed(1)} % vs ${(target*100).toFixed(0)} %). Vous laissez du rendement sur la table.` })

    // ── 10. Mismatch horizon long / tolérance très basse ──
    if (h >= 20 && profile.loss < 15 && actionsW < 0.3)
      recs.push({ icon: '⏳', severity: 'low',
        text: `Horizon de ${h} ans mais tolérance aux pertes très faible (${profile.loss} %) et peu d'actions (${(actionsW*100).toFixed(0)} %). Sur un horizon si long, la volatilité court terme est du bruit — un profil plus dynamique optimiserait votre rendement.` })

    // ── 11. Risque de change significatif ──
    if (showFX && histStats && sigma > 0 && sigmaFX > sigma * 1.15)
      recs.push({ icon: '💱', severity: 'medium',
        text: `Le change ajoute ${((sigmaFX - sigma)*100).toFixed(1)} pt de volatilité annuelle (${(sigma*100).toFixed(1)} % → ${(sigmaFX*100).toFixed(1)} % en CHF). Envisagez des actifs libellés en CHF ou des ETF couverts contre le change.` })

    // ── 12. Monte Carlo : risque de perte à l'horizon déclaré ──
    const mcIdx = Math.min(h * 12, mcBands.length - 1)
    if (mcBands.length > 0 && mcIdx > 0 && mcBands[mcIdx].p5 < 1.0)
      recs.push({ icon: '🎲', severity: 'medium',
        text: `Dans 5 % des scénarios Monte Carlo, votre portefeuille vaut moins que la mise initiale à l'horizon de ${h} an${h > 1 ? 's' : ''} (×${mcBands[mcIdx].p5.toFixed(2)}). Ce risque de perte nette mérite attention.` })

    // ── 13. Encouragement si portefeuille bien calibré ──
    if (scoreTotal >= 80 && recs.length === 0)
      recs.push({ icon: '✅', severity: 'low',
        text: `Votre portefeuille est bien calibré par rapport à votre profil (score ${scoreTotal}/100). Continuez à surveiller votre allocation et à rééquilibrer annuellement.` })

    return recs.sort((a, b) => {
      const rank = (s: string) => s === 'high' ? 0 : s === 'medium' ? 1 : 2
      return rank(a.severity) - rank(b.severity)
    }).slice(0, 6)
  }, [scoreResult, er, sigma, sigmaFX, sharpe, effN, hhi, catWeights, profile, showFX, histStats, mcBands])

  // ── Frontière efficiente ──
  const frontier = React.useMemo(() => {
    if (!hasPositions) return { pts: [], current: null, maxSharpe: null, minSigma: null }

    // Données historiques disponibles : points pré-calculés dans useEffect (déterministes)
    if (histStats?.frontierPts && histStats.frontierPts.length > 0) {
      const rawPts = (showFX && histStats.frontierPtsFX?.length ? histStats.frontierPtsFX : histStats.frontierPts)
      const pts = rawPts.map(p => ({ ...p, w: {} as Record<string, number> }))
      const current   = { r: erEff, s: sigmaEff, sh: sigmaEff > 0 ? (erEff - RF_RATE) / sigmaEff : 0 }
      const maxSharpe = pts.reduce((b, p) => p.sh > b.sh ? p : b, pts[0])
      const minSigma  = pts.reduce((b, p) => p.s  < b.s  ? p : b, pts[0])
      return { pts, current, maxSharpe, minSigma }
    }

    // Fallback CAPM (données historiques pas encore chargées)
    const pts: { r: number; s: number; sh: number; w: Record<string, number> }[] = []
    for (let i = 0; i < 500; i++) {
      const raws = CATS.map(() => -Math.log(Math.random()))
      const sum  = raws.reduce((a, b) => a + b, 0)
      const w: Record<string, number> = {}
      CATS.forEach((c, j) => { w[c] = raws[j] / sum })
      const r = portfolioER(w), s = portfolioSigma(w)
      pts.push({ r, s, sh: s > 0 ? (r - RF_RATE) / s : 0, w })
    }
    const current  = { r: erEff, s: sigmaEff, sh: sigmaEff > 0 ? (erEff - RF_RATE) / sigmaEff : 0 }
    const maxSharpe = pts.reduce((b, p) => p.sh > b.sh ? p : b, pts[0])
    const minSigma  = pts.reduce((b, p) => p.s < b.s  ? p : b, pts[0])
    return { pts, current, maxSharpe, minSigma }
  }, [hasPositions, catWeights, erEff, sigmaEff, histStats, showFX])

  // ── SVG helpers ──
  const W = 560, H = 220, PAD = { t: 16, r: 16, b: 32, l: 52 }
  const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b

  function mcSVG() {
    if (mcBands.length < 2) return null
    const T = mcBands.length
    const allVals = mcBands.flatMap(b => [b.p5, b.p95])
    const rawMin = Math.min(...allVals)
    const rawMax = Math.max(...allVals)
    // Padding multiplicatif 5 % — reste toujours positif (valeurs MC > 0 par construction)
    const lo = rawMin * 0.95
    const hi = rawMax * 1.05
    // Palier : premier multiple rond qui couvre la plage
    const niceStep = (() => {
      const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
      const raw = (hi - lo) / 10
      return candidates.find(s => s >= raw) ?? 10000
    })()
    // Les bornes du graphique = les bords des ticks (données toujours dans le cadre)
    const minY = Math.max(0, Math.floor(lo / niceStep) * niceStep)
    const maxY = Math.ceil(hi  / niceStep) * niceStep
    const xS = (i: number) => PAD.l + (i / (T - 1)) * PW
    const yS = (v: number) => PAD.t + PH - ((v - minY) / (maxY - minY || 1)) * PH
    const line = (key: 'p5' | 'p25' | 'p50' | 'p75' | 'p95') =>
      mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[key]).toFixed(1)}`).join(' ')
    const area = (hi: 'p95' | 'p75', lo: 'p5' | 'p25') => {
      const fwd = mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[hi]).toFixed(1)}`).join(' ')
      const bwd = [...mcBands].reverse().map((b, i) => `L${xS(T - 1 - i).toFixed(1)},${yS(b[lo]).toFixed(1)}`).join(' ')
      return fwd + bwd + 'Z'
    }
    // Ticks Y — paliers réguliers arrodnis
    const decimals = niceStep < 1 ? 1 : 0
    const ticks: { y: number; label: string; isOrigin: boolean }[] = []
    for (let v = minY; v <= maxY + 1e-9; v = Math.round((v + niceStep) * 1e9) / 1e9) {
      if (Math.abs(v) < 1e-9) continue  // ne pas afficher ×0
      ticks.push({ y: yS(v), label: `×${v.toFixed(decimals)}`, isOrigin: Math.abs(v - 1) < 1e-9 })
    }
    // Limiter à 10 labels max (décimation uniforme)
    const _maxL = 10
    const _decim = ticks.length > _maxL ? Math.ceil(ticks.length / _maxL) : 1
    const visibleTicks = ticks.filter((_, i) => i % _decim === 0)
    // Si ×1.0 n'est pas déjà un tick, l'ajouter comme repère
    const hasOrigin = visibleTicks.some(t => t.isOrigin)
    const originY = yS(1)
    // Ticks en années — tous les 5 ans
    const xTicks: { x: number; label: string }[] = []
    for (let yr = 5; yr <= 20; yr += 5) {
      xTicks.push({ x: xS(yr * 12), label: `${yr} ans` })
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        <defs>
          <linearGradient id="mc-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14B8A6" stopOpacity="0.25"/><stop offset="100%" stopColor="#14B8A6" stopOpacity="0.05"/></linearGradient>
          <linearGradient id="mc-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14B8A6" stopOpacity="0.12"/><stop offset="100%" stopColor="#14B8A6" stopOpacity="0.03"/></linearGradient>
        </defs>
        {visibleTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y}
              stroke={tk.isOrigin ? '#9E9A93' : '#DDD9D1'}
              strokeWidth={tk.isOrigin ? 1 : 0.5}
              strokeDasharray={tk.isOrigin ? undefined : '3,3'}/>
            <text x={PAD.l - 4} y={tk.y + 4} textAnchor="end" fontSize="9"
              fill={tk.isOrigin ? '#5A5550' : '#8899AA'}
              fontWeight={tk.isOrigin ? '600' : undefined}>{tk.label}</text>
          </g>
        ))}
        {!hasOrigin && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={originY} y2={originY} stroke="#9E9A93" strokeWidth="1"/>
            <text x={PAD.l - 4} y={originY + 4} textAnchor="end" fontSize="9" fill="#5A5550" fontWeight="600">×1</text>
          </g>
        )}
        {xTicks.map((tk, i) => (
          <text key={i} x={tk.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8899AA">{tk.label}</text>
        ))}
        <path d={area('p95', 'p5')}  fill="url(#mc-g2)"/>
        <path d={area('p75', 'p25')} fill="url(#mc-g1)"/>
        <path d={line('p95')} fill="none" stroke="#14B8A6" strokeWidth="0.8" strokeDasharray="4,2"/>
        <path d={line('p5')}  fill="none" stroke="#14B8A6" strokeWidth="0.8" strokeDasharray="4,2"/>
        <path d={line('p75')} fill="none" stroke="#14B8A6" strokeWidth="1.2"/>
        <path d={line('p25')} fill="none" stroke="#14B8A6" strokeWidth="1.2"/>
        <path d={line('p50')} fill="none" stroke="#14B8A6" strokeWidth="2"/>
        <circle cx={xS(T - 1)} cy={yS(mcBands[T - 1].p50)} r="3" fill="#14B8A6"/>
      </svg>
    )
  }

  function frontierSVG() {
    const { pts, current, maxSharpe, minSigma } = frontier
    if (!pts.length || !current) return null
    const xs = pts.map(p => p.s), ys = pts.map(p => p.r)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minYv = Math.min(...ys), maxYv = Math.max(...ys)
    const xS = (v: number) => PAD.l + ((v - minX) / (maxX - minX || 1)) * PW
    const yS = (v: number) => PAD.t + PH - ((v - minYv) / (maxYv - minYv || 1)) * PH
    const tX = Array.from({ length: 5 }, (_, i) => {
      const v = minX + (i / 4) * (maxX - minX)
      return { x: xS(v), label: `${(v * 100).toFixed(0)}%` }
    })
    const tY = Array.from({ length: 5 }, (_, i) => {
      const v = minYv + (i / 4) * (maxYv - minYv)
      return { y: yS(v), label: `${(v * 100).toFixed(1)}%` }
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {tY.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3,3"/>
            <text x={PAD.l - 4} y={tk.y + 4} textAnchor="end" fontSize="9" fill="#8899AA">{tk.label}</text>
          </g>
        ))}
        {tX.map((tk, i) => <text key={i} x={tk.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8899AA">{tk.label}</text>)}
        <text x={PAD.l + PW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#8899AA">σ (risque)</text>
        <text x={10} y={PAD.t + PH / 2} textAnchor="middle" fontSize="9" fill="#8899AA" transform={`rotate(-90,10,${PAD.t + PH / 2})`}>E(R)</text>
        {pts.map((p, i) => <circle key={i} cx={xS(p.s)} cy={yS(p.r)} r="2" fill="#14B8A6" fillOpacity="0.25"/>)}
        {minSigma  && <circle cx={xS(minSigma.s)}  cy={yS(minSigma.r)}  r="5" fill="#3B82F6" stroke="white" strokeWidth="1.5"/>}
        {maxSharpe && <circle cx={xS(maxSharpe.s)} cy={yS(maxSharpe.r)} r="5" fill="#F59E0B" stroke="white" strokeWidth="1.5"/>}
        <circle cx={xS(current.s)} cy={yS(current.r)} r="6" fill="#EF4444" stroke="white" strokeWidth="2"/>
        <text x={xS(current.s) + 8} y={yS(current.r) + 4} fontSize="10" fill="#EF4444" fontWeight="600">Votre portefeuille</text>
        {maxSharpe && <text x={xS(maxSharpe.s) + 8} y={yS(maxSharpe.r) + 4} fontSize="9" fill="#F59E0B">Max Sharpe</text>}
        {minSigma  && <text x={xS(minSigma.s) + 8}  y={yS(minSigma.r) + 4}  fontSize="9" fill="#3B82F6">Min σ</text>}
      </svg>
    )
  }

  const tile = (label: string, value: string, sub?: string, color?: string, fxVal?: string) => (
    <div className="relative bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-4 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] leading-tight pr-1">{label}</p>
        {sub && (
          <button
            className="flex-shrink-0 w-4 h-4 rounded-full text-[9px] font-bold border flex items-center justify-center transition-colors"
            style={{ color: tip === label ? '#14B8A6' : '#8899AA', borderColor: tip === label ? '#14B8A6' : '#C4C9D4' }}
            onMouseEnter={() => setTip(label)}
            onMouseLeave={() => setTip(null)}
            onClick={() => setTip(tip === label ? null : label)}
          >?</button>
        )}
      </div>
      <p className="text-lg font-semibold" style={{ color: color ?? 'inherit' }}>{value}</p>
      {fxVal && (
        <p className="text-[10px] text-[#9E9A93] dark:text-[#5C7080] leading-tight">{fxVal}</p>
      )}
      {tip === label && sub && (
        <div className="absolute top-0 right-6 z-30 bg-[#1B3050] text-white text-xs rounded-sm px-3 py-2 w-56 shadow-xl" style={{ transform: 'translateY(-105%)' }}>
          {sub}
          <div className="absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-[#1B3050] rotate-45"/>
        </div>
      )}
    </div>
  )

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-[#14B8A6]"/>
        <h2 className="text-lg font-semibold text-[#1B3050] dark:text-white">Analyse du portefeuille</h2>
      </div>

      {/* Analyses quantitatives (uniquement si positions) */}
      {hasPositions && (
        <div className="bg-white dark:bg-[#1E2530] rounded border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-[#DDD9D1] dark:border-[#2A3240]">
            <div className="flex overflow-x-auto flex-1">
              {([
                ['stats',       'Statistiques'],
                ['montecarlo',  'Monte Carlo'],
                ['stress',      'Stress Tests'],
                ['frontier',    'Frontière efficiente'],
                ['historique',  'Données historiques'],
              ] as const).map(([key, lbl]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key
                    ? 'border-[#14B8A6] text-[#14B8A6]'
                    : 'border-transparent text-[#5C6880] dark:text-[#7B8DA6] hover:text-[#1B3050] dark:hover:text-white'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex items-center flex-shrink-0 gap-1 mx-3">
              {histStats && (
                <button onClick={() => setShowFX(v => !v)}
                  title={showFX ? 'Afficher en devise locale' : 'Afficher en CHF (FX inclus)'}
                  className={`px-2.5 py-1 rounded-sm border text-base transition-all ${showFX ? 'border-[#B5820F] bg-[#FEF3C7] dark:bg-[#2a2010]' : 'border-[#DDD9D1] dark:border-[#323B4A] opacity-50 hover:opacity-100'}`}>
                  🇨🇭
                </button>
              )}
              <button onClick={() => setLongMode(v => !v)}
                title={longMode ? 'Mode journalier (10 ans)' : 'Mode mensuel (historique maximum)'}
                className={`px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-all ${longMode ? 'border-[#14B8A6] bg-[#E8F5F1] dark:bg-[#0d2e24] text-[#14B8A6] dark:text-[#5EC9A5]' : 'border-[#DDD9D1] dark:border-[#323B4A] text-[#8899AA] opacity-50 hover:opacity-100'}`}>
                📅 max
              </button>
            </div>
          </div>

          <div className="p-6">

            {/* ── Statistiques ── */}
            {tab === 'stats' && (
              <div className="space-y-4">
                <p className="text-xs text-[#8899AA]">
                  {histLoading
                    ? '⏳ Chargement des données historiques…'
                    : histStats
                    ? `📈 Basé sur les cours réels de vos actifs entre ${histStats.periodStart.slice(0,7)} et ${histStats.periodEnd.slice(0,7)} (${histStats.yearsCount.toFixed(1)} ans · données ${histStats.isMonthly ? "mensuelles" : "journalières"})`
                    : '⚠️ Estimations CAPM (données historiques indisponibles — β par catégorie, matrice de corrélation 6×6)'}
                </p>
                {(() => {
                  const erD     = erEff
                  const sigD    = sigmaEff
                  const sharpeD = sigD > 0 ? (erD - RF_RATE) / sigD : 0
                  const var95D  = erD - 1.645 * sigD
                  const cvar95D = erD - 2.063 * sigD
                  const var95mD = erD / 12 - 1.645 * sigD / Math.sqrt(12)
                  const inCHF   = showFX && histStats
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {tile(
                        'Rendement annuel attendu',
                        `${(erD * 100).toFixed(2)} %`,
                        inCHF
                          ? `Gain moyen annuel sur la période analysée, en CHF. Historique — les années futures peuvent différer. · Formule : moyenne des rendements ${histStats?.isMonthly ? 'mensuels × 12' : 'journaliers × 252'}, converti en CHF`
                          : `Gain moyen annuel sur la période analysée. Historique — les années futures peuvent différer. · Formule : moyenne des rendements ${histStats?.isMonthly ? 'mensuels × 12' : 'journaliers × 252'}`,
                        '#14B8A6'
                      )}
                      {tile(
                        'Volatilité annuelle',
                        `${(sigD * 100).toFixed(2)} %`,
                        inCHF
                          ? `Amplitude des variations annuelles de votre portefeuille, en CHF. Plus c'est élevé, plus les hausses et baisses sont fortes. · Formule : σ ${histStats?.isMonthly ? 'mensuelle × √12' : 'journalière × √252'}, converti en CHF`
                          : `Amplitude des variations annuelles de votre portefeuille. Plus c'est élevé, plus les hausses et baisses sont fortes. · Formule : σ journalière × √252`
                      )}
                      {tile(
                        'Ratio de Sharpe',
                        sharpeD.toFixed(3),
                        `Rendement obtenu par unité de risque prise. ≥ 1 : excellent · ≥ 0,5 : correct · < 0,5 : risque mal compensé. · Formule : (E(Rp) − Rf) / σ · Rf = ${(RF_RATE * 100).toFixed(1)} %`,
                        sharpeD >= 1 ? '#22C55E' : sharpeD >= 0.5 ? '#F59E0B' : '#EF4444'
                      )}
                      {tile('Perte max probable / an', `${(var95D * 100).toFixed(2)} %`,
                        `Dans 95 % des années, la perte ne dépassera pas ce seuil. Il reste 5 % de chances de faire pire. · Formule : VaR 95 % = E(Rp) − 1,645 × σ`
                      )}
                      {/* Pire baisse historique réelle si dispo, sinon CVaR paramétrique */}
                      {histStats?.maxDrawdown !== undefined
                        ? tile('Max Drawdown',
                            `${(Math.abs(histStats.maxDrawdown) * 100).toFixed(1)} %`,
                            `La plus forte baisse réelle observée sur la période analysée, du sommet au creux. Mesure concrète du pire scénario passé — plus parlant que la CVaR théorique. · Calculée sur ${histStats.yearsCount.toFixed(1)} ans de données réelles`,
                            Math.abs(histStats.maxDrawdown) > 0.4 ? '#EF4444' : Math.abs(histStats.maxDrawdown) > 0.2 ? '#F59E0B' : '#22C55E'
                          )
                        : tile('Perte extrême moyenne / an', `${(cvar95D * 100).toFixed(2)} %`,
                            `Perte moyenne dans les 5 % de pires années. Le scénario de crise, pas le cas habituel. · Formule : CVaR 95 % = E(Rp) − 2,063 × σ`
                          )
                      }
                      {tile('Perte max probable / mois', `${(var95mD * 100).toFixed(2)} %`,
                        `Dans 95 % des mois, la perte ne dépassera pas ce seuil. Utile pour jauger votre confort face aux baisses à court terme. · Formule : VaR 95 % mensuelle = E(Rp)/12 − 1,645 × σ / √12`
                      )}
                      {tile('N effectif', effN.toFixed(1),
                        `Nombre d'actifs équivalents si votre portefeuille était parfaitement équipondéré. 10 lignes qui bougent ensemble = N effectif proche de 1. · < 2 : trop concentré · 2–4 : modéré · ≥ 4 : bonne répartition · Formule : N eff = 1 / Σ wᵢ²`,
                        effN < 2 ? '#EF4444' : effN < 4 ? '#F59E0B' : '#22C55E'
                      )}
                      {/* Diversification Ratio ajusté corrélations si dispo, sinon N effectif */}
                      {(() => {
                        const drVal = scoreResult?.dr ?? null
                        if (drVal !== null && histStats) {
                          const drColor = drVal >= 1.5 ? '#22C55E' : drVal >= 1.2 ? '#F59E0B' : '#EF4444'
                          return tile('Bénéfice de diversification',
                            `×${drVal.toFixed(2)}`,
                            `Mesure si vos actifs se compensent vraiment entre eux. ×1,0 = ils bougent tous ensemble (aucun bénéfice). Plus c'est élevé, mieux vos actifs se complètent. · Formule : DR = Σ(wᵢ × σᵢ) / σp · ≥ 1,5 : bonne diversification · < 1,2 : actifs trop corrélés`,
                            drColor
                          )
                        }
                        return tile('Diversification effective', effN.toFixed(1),
                          `Nombre d'actifs vraiment indépendants que votre portefeuille équivaut à détenir. 10 actifs qui bougent ensemble = score proche de 1. Plus c'est élevé, mieux c'est. · Formule : 1 / HHI · Idéalement ≥ 5`
                        )
                      })()}
                      {portfolioScore !== null && tile('Score du portefeuille', `${portfolioScore} / 100`,
                        (() => {
                          const sr = scoreResult!
                          const pct = (w: number) => `${Math.round(w * 100)} %`
                          return `Note sur 100 adaptée à votre profil. Poids par quadrant : Q1 Horizon ${pct(sr.wts.q1)} · Q2 Pertes ${pct(sr.wts.q2)} · Q3 Liquidité ${pct(sr.wts.q3)} · Q4 Rendement ${pct(sr.wts.q4)}. Les poids changent selon votre horizon : liquidité en priorité sur court terme, rendement sur long terme.`
                        })(),
                        portfolioScore >= 75 ? '#22C55E' : portfolioScore >= 50 ? '#F59E0B' : '#EF4444'
                      )}
                    </div>
                  )
                })()}

                {/* ── Recommandations ── */}
                {recommendations.length > 0 && (
                  <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#F5F3EF] dark:border-[#2A3240] flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Recommandations</p>
                      <span className="text-[10px] text-[#9E9A93]">{recommendations.filter(r => r.severity === 'high').length > 0 && <span className="text-red-500 font-semibold">{recommendations.filter(r => r.severity === 'high').length} critique{recommendations.filter(r => r.severity === 'high').length > 1 ? 's' : ''}</span>}</span>
                    </div>
                    <div className="divide-y divide-[#F5F3EF] dark:divide-[#2A3240]">
                    {recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderLeft: `3px solid ${r.severity === 'high' ? '#EF4444' : r.severity === 'medium' ? '#F59E0B' : '#22C55E'}` }}>
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm mt-0.5 ${r.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30' : r.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                          {r.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`inline-block text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1 mr-1 ${r.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : r.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                            {r.severity === 'high' ? 'Critique' : r.severity === 'medium' ? 'Attention' : 'Info'}
                          </span>
                          <p className="text-xs text-[#3D4F62] dark:text-[#A8BBCC] leading-relaxed">{r.text}</p>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Monte Carlo ── */}
            {tab === 'montecarlo' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">{mcBands.length > 0 ? <>2 000 scénarios simulés mois par mois sur 20 ans, basés sur la volatilité annuelle et le rendement annuel attendu de votre portefeuille (section Statistiques). La <strong className="text-[#1B3050] dark:text-white">ligne épaisse</strong> = résultat médian. La <strong className="text-[#1B3050] dark:text-white">zone sombre</strong> = la moitié des scénarios (entre le défavorable et le favorable). La <strong className="text-[#1B3050] dark:text-white">zone claire</strong> = 90 % des scénarios en enlevant les 5 % de chaque extrême (de ×{mcBands[mcBands.length - 1].p5.toFixed(2)} à ×{mcBands[mcBands.length - 1].p95.toFixed(2)}).{showFX && histStats ? ' · CHF (FX inclus)' : ''}</> : <>2 000 scénarios simulés mois par mois sur 20 ans.</>}</p>
                </div>
                <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-3 bg-[#FAFAF8] dark:bg-[#253040]">
                  {mcSVG()}
                </div>
                {mcBands.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tile('Résultat médian', `×${mcBands[mcBands.length - 1].p50.toFixed(2)}`, `Dans 1 scénario sur 2, votre portefeuille atteint au moins ce multiple à 20 ans. C'est le résultat "typique".`, '#14B8A6')}
                    {tile('Scénario favorable', `×${mcBands[mcBands.length - 1].p75.toFixed(2)}`, `Dans 1 scénario sur 4, votre portefeuille fait encore mieux. C'est un bon résultat, sans être exceptionnel.`)}
                    {tile('Scénario défavorable', `×${mcBands[mcBands.length - 1].p25.toFixed(2)}`, `Dans 3 scénarios sur 4, votre portefeuille fait mieux que ça. C'est le plancher probable hors crise majeure et durable.`, '#F97316')}
                  </div>
                )}
              </div>
            )}

            {/* ── Stress Tests ── */}
            {tab === 'stress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">{histStats ? 'Simulation : si vous aviez détenu ce portefeuille (mêmes proportions) pendant ces crises, voici la perte que vous auriez subie. Le temps de récupération est estimé selon le rendement annuel moyen de votre portefeuille.' : 'Estimation de la perte basée sur des chocs types par catégorie d\'actifs. Le temps de récupération est estimé selon le rendement annuel moyen de votre portefeuille.'}{showFX && histStats ? ' · CHF (FX inclus)' : ''}</p>
                </div>
                {stressResults.length === 0 && histStats && (
                  <p className="text-sm text-[#8899AA] text-center py-4">Aucune crise historique ne couvre la période de vos actifs.</p>
                )}
                {stressResults.map((sc, i) => (
                  <div key={i} className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-4 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{sc.label}</p>
                      <span className="text-sm font-bold" style={{ color: sc.loss < -0.15 ? '#EF4444' : sc.loss < 0 ? '#F97316' : '#22C55E' }}>
                        {sc.loss >= 0 ? '+' : ''}{(sc.loss * 100).toFixed(1)} %
                      </span>
                    </div>
                    {/* Barre */}
                    <div className="h-3 rounded-full bg-[#F0EDE8] dark:bg-[#253040] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, Math.abs(sc.loss) * 100)}%`,
                        background: sc.loss < -0.15 ? '#EF4444' : sc.loss < 0 ? '#F97316' : '#22C55E'
                      }}/>
                    </div>
                    <p className="text-xs text-[#8899AA]">
                      {sc.loss < 0
                        ? `Récupération estimée : ~${sc.recovery} an${sc.recovery > 1 ? 's' : ''} (E(Rp) = ${(erEff * 100).toFixed(1)} %/an${showFX && histStats ? ' CHF' : ''})`
                        : 'Gain net — aucune perte de capital.'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Frontière efficiente ── */}
            {tab === 'frontier' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">
                    {histStats
                      ? <>5 000 répartitions aléatoires testées sur {Math.round(histStats.yearsCount * 10) / 10} ans de données réelles{showFX ? ' (en CHF)' : ''}. Chaque point = une façon différente de distribuer votre argent entre vos actifs. <span className="text-[#EF4444] font-medium">Rouge</span> = votre portefeuille actuel · <span className="text-[#F59E0B] font-medium">Jaune</span> = meilleur rendement pour le risque pris · <span className="text-[#3B82F6] font-medium">Bleu</span> = risque le plus faible.</>
                      : <>500 répartitions aléatoires testées. Chaque point = une façon différente de distribuer votre argent entre vos actifs. <span className="text-[#EF4444] font-medium">Rouge</span> = votre portefeuille actuel · <span className="text-[#F59E0B] font-medium">Jaune</span> = meilleur rendement pour le risque pris · <span className="text-[#3B82F6] font-medium">Bleu</span> = risque le plus faible.</>
                    }
                  </p>
                </div>
                <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-3 bg-[#FAFAF8] dark:bg-[#253040]">
                  {frontierSVG()}
                </div>
                {frontier.maxSharpe && frontier.minSigma && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tile('Votre Sharpe', frontier.current ? frontier.current.sh.toFixed(3) : sharpe.toFixed(3), `E(R) ${(erEff*100).toFixed(1)} % / σ ${(sigmaEff*100).toFixed(1)} %${showFX && histStats ? ' · CHF' : ''}`, '#EF4444')}
                    {tile('Max Sharpe', frontier.maxSharpe.sh.toFixed(3), `E(R) ${(frontier.maxSharpe.r * 100).toFixed(1)} % / σ ${(frontier.maxSharpe.s * 100).toFixed(1)} %`, '#F59E0B')}
                    {tile('Min σ', `${(frontier.minSigma.s * 100).toFixed(1)} %`, `E(R) ${(frontier.minSigma.r * 100).toFixed(1)} %`, '#3B82F6')}
                  </div>
                )}
                {histStats && histStats.optWeights.length >= 1 && (
                  <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#F5F3EF] dark:border-[#2A3240] flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Poids par actif</p>
                      <div className="flex gap-4 text-xs text-[#8899AA]">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]"/> Actuel</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F59E0B]"/> Max Sharpe</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3B82F6]"/> Min vol</span>
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#F5F3EF] dark:border-[#2A3240]">
                          <th className="px-4 py-2 text-left font-semibold text-[#5C6880] uppercase tracking-wider">Actif</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#EF4444] uppercase tracking-wider">Actuel</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#F59E0B] uppercase tracking-wider">Max Sharpe</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#3B82F6] uppercase tracking-wider">Min vol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#2A3240]">
                        {(() => {
                          // Group by ticker
                          const tickerOrder: string[] = []
                          const grouped: Record<string, typeof histStats.optWeights> = {}
                          for (const a of histStats.optWeights) {
                            if (!grouped[a.ticker]) { tickerOrder.push(a.ticker); grouped[a.ticker] = [] }
                            grouped[a.ticker].push(a)
                          }
                          tickerOrder.sort((ta, tb) => {
                            const wa = grouped[ta].reduce((s, a) => s + a.wCurrent, 0)
                            const wb = grouped[tb].reduce((s, a) => s + a.wCurrent, 0)
                            return wb - wa
                          })
                          return tickerOrder.map(ticker => {
                            const lots = grouped[ticker]
                            const isMulti = lots.length > 1
                            const isExp = expandedFrontierTickers.has(ticker)
                            const toggle = () => setExpandedFrontierTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                            const gCurrent = lots.reduce((s, a) => s + a.wCurrent, 0)
                            const gOptimal = lots.reduce((s, a) => s + a.wOptimal, 0)
                            const gMinVol  = lots.reduce((s, a) => s + a.wMinVol, 0)
                            const nom = lots[0].nom
                            return (
                              <React.Fragment key={ticker}>
                                <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#253040]/50 ${isExp ? 'bg-[#F5F3EF]/30 dark:bg-[#1E2530]/30' : ''}`}>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      {isMulti && (
                                        <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                          {isExp ? '▾' : '▸'}
                                        </button>
                                      )}
                                      <div>
                                        <span className="font-medium text-[#1B3050] dark:text-white">{ticker}</span>
                                        <span className="ml-1.5 text-[#9E9A93]">{nom.length > 22 ? nom.slice(0, 22) + '…' : nom}</span>
                                        {isMulti && <span className="ml-1 text-[#9E9A93]">· {lots.length} lots</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#EF4444]">{(gCurrent * 100).toFixed(1)} %</td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#F59E0B]">{(gOptimal * 100).toFixed(1)} %</td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#3B82F6]">{(gMinVol * 100).toFixed(1)} %</td>
                                </tr>
                                {isMulti && isExp && lots.map((a, i) => (
                                  <tr key={i} className="bg-[#F5F3EF]/60 dark:bg-[#1E2530]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                    <td className="px-4 py-2 pl-9 text-xs">Lot {i + 1}</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#EF4444]">{(a.wCurrent * 100).toFixed(1)} %</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#F59E0B]">{(a.wOptimal * 100).toFixed(1)} %</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#3B82F6]">{(a.wMinVol * 100).toFixed(1)} %</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                    <p className="px-4 py-2 text-xs text-[#9E9A93] border-t border-[#F5F3EF] dark:border-[#2A3240]">
                      Monte Carlo sur données réelles — {histStats.yearsCount.toFixed(1)} ans · {histStats.optWeights.length} actif{histStats.optWeights.length > 1 ? 's' : ''} inclus
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Données historiques ── */}
            {tab === 'historique' && (
              <div className="space-y-4">
                {histLoading && (
                  <div className="flex items-center gap-3 text-sm text-[#5C6880] dark:text-[#7B8DA6]">
                    <svg className="animate-spin h-4 w-4 text-[#14B8A6]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Récupération des données historiques Twelve Data…
                  </div>
                )}

                {!histLoading && !histStats && (
                  <p className="text-sm text-[#8899AA]">Impossible de récupérer les données historiques. Les statistiques affichées sont des estimations CAPM.</p>
                )}

                {histStats && (
                  <>
                    {/* Boutons — légende */}
                    <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-4 space-y-3">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Contrôles de l'analyse</p>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-base flex-shrink-0 mt-0.5 ${showFX ? 'border-[#B5820F] bg-[#FEF3C7] dark:bg-[#2a2010]' : 'border-[#DDD9D1] dark:border-[#323B4A] opacity-60'}`}>🇨🇭</span>
                          <div>
                            <p className="text-xs font-medium text-[#1B3050] dark:text-white">Ajustement CHF</p>
                            <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">Convertit tous les rendements en francs suisses en intégrant les variations de change. Utile si vos actifs sont libellés en USD, EUR ou GBP — vous voyez ce que le portefeuille rapporte réellement en CHF, change inclus.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold flex-shrink-0 mt-0.5 ${longMode ? 'border-[#14B8A6] bg-[#E8F5F1] dark:bg-[#0d2e24] text-[#14B8A6] dark:text-[#5EC9A5]' : 'border-[#DDD9D1] dark:border-[#323B4A] text-[#8899AA] opacity-60'}`}>📅 max</span>
                          <div>
                            <p className="text-xs font-medium text-[#1B3050] dark:text-white">Historique long (jusqu'à 30 ans)</p>
                            <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">Passe en données <strong className="text-[#1B3050] dark:text-white">mensuelles</strong> sur un maximum de 30 ans d'historique au lieu des 10 ans journaliers. Plus adapté pour mesurer le comportement long terme et les cycles économiques complets. Seuls les actifs avec au moins 10 ans d'historique sont inclus — les autres sont déjà couverts par le mode journalier.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Méthodologie en premier */}
                    <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-4 space-y-2">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Comment ces chiffres sont calculés</p>
                      <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">
                        Toutes les statistiques sont basées sur les cours réels de vos actifs entre{' '}
                        <strong className="text-[#1B3050] dark:text-white">
                          {new Date(histStats.periodStart).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
                        </strong>
                        {' '}et{' '}
                        <strong className="text-[#1B3050] dark:text-white">
                          {new Date(histStats.periodEnd).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
                        </strong>
                        {' '}({histStats.yearsCount.toFixed(1)} ans), fournis par Twelve Data et ajustés pour les divisions d&apos;actions. {histStats.isMonthly ? 'On mesure chaque mois la variation de valeur du portefeuille en appliquant vos proportions actuelles sur toute cette période — comme si vous aviez toujours détenu ces actifs dans ces mêmes proportions. Le rendement annuel et le risque sont ensuite calculés à partir de ces variations mensuelles.' : 'On mesure chaque jour la variation de valeur du portefeuille en appliquant vos proportions actuelles sur toute cette période — comme si vous aviez toujours détenu ces actifs dans ces mêmes proportions. Le rendement annuel et le risque sont ensuite calculés à partir de ces variations journalières.'}
                      </p>
                      <div className="space-y-1 text-xs text-[#8899AA] pt-1 border-t border-[#F5F3EF] dark:border-[#2A3240]">
                        <p>· E(Rp) = moyenne des rendements {histStats?.isMonthly ? 'mensuels × 12 (mois par an)' : 'journaliers × 252 (jours de bourse par an)'}</p>
                        <p>· σ = écart-type des rendements {histStats?.isMonthly ? 'mensuels × √12 (annualisé)' : 'journaliers × √252 (annualisé)'}</p>
                        <p>· VaR et CVaR paramétriques (loi normale, 95 %)</p>
                      </div>
                    </div>

                    {/* Tous les actifs — statut unifié */}
                    {(() => {
                      const allAssets = [
                        ...histStats.optWeights.map(a => {
                          const reducedEntry = histStats.reduced.find(r => r.ticker === a.ticker)
                          const isReduced = !!reducedEntry
                          return { ticker: a.ticker, nom: a.nom, status: isReduced ? 'reduced' : 'included' as 'included' | 'reduced' | 'excluded', years: isReduced && reducedEntry ? reducedEntry.years : histStats.yearsCount }
                        }),
                        ...histStats.excluded.map(a => ({ ticker: a.ticker, nom: a.nom, status: 'excluded' as const, years: a.years })),
                      ]
                      if (allAssets.length === 0) return null
                      const badge = (status: string) => {
                        if (status === 'included') return <span className="text-[#14B8A6] font-semibold">✅ Inclus</span>
                        if (status === 'reduced')  return <span className="text-[#D97706] font-semibold">⚠️ Réduit</span>
                        return <span className="text-[#EF4444] font-semibold">⛔ Exclu</span>
                      }
                      const yearsColor = (status: string) =>
                        status === 'included' ? 'text-[#14B8A6]' : status === 'reduced' ? 'text-[#D97706]' : 'text-[#EF4444]'
                      return (
                        <div className="rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] bg-white dark:bg-[#1E2530] p-4 space-y-3">
                          <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Actifs du portefeuille</p>
                          <div className="space-y-2">
                            {allAssets.map(a => (
                              <div key={a.ticker} className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-[#1B3050] dark:text-white min-w-0 truncate">
                                  {a.nom} <span className="text-[#8899AA]">({a.ticker})</span>
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  {badge(a.status)}
                                  <span className={`font-mono ${yearsColor(a.status)}`}>
                                    {a.years > 0 ? `${a.years.toFixed(1)} ans` : '—'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-[#8899AA] border-t border-[#F5F3EF] dark:border-[#2A3240] pt-2">
                            <strong>Inclus</strong> = pris en compte dans toutes les statistiques. <strong>Réduit</strong> = inclus mais avec moins d&apos;historique, ce qui raccourcit la période d&apos;analyse commune. <strong>Exclu</strong> = moins de {longMode ? '10' : '3'} ans de données, non pris en compte en mode {longMode ? 'mensuel' : 'journalier'} (son poids est redistribué aux autres actifs).
                          </p>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Main ─────────────────────────────────────────────────────────────────────


function FormDatePicker({ value, onChange, min, max }: {
  value: string; onChange: (v: string) => void; min?: string; max?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pickerMode, setPickerMode] = React.useState<null | 'month' | 'year'>(null)
  // Timezone-safe: on construit la chaîne depuis les composantes locales,
  // new Date(y,m,d).toISOString() donnerait le jour précédent en UTC+2.
  const localDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const todayLocal = new Date()
  const todayStr = localDateStr(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
  const maxStr = max || todayStr
  const maxYear = parseInt(maxStr.slice(0,4))
  const parseDate = (s: string) => s ? { y: parseInt(s.slice(0,4)), m: parseInt(s.slice(5,7))-1 } : { y: todayLocal.getFullYear(), m: todayLocal.getMonth() }
  const [viewYear, setViewYear] = React.useState(() => parseDate(value).y)
  const [viewMonth, setViewMonth] = React.useState(() => parseDate(value).m)
  const [yearPage, setYearPage] = React.useState(() => Math.floor(parseDate(value).y / 12) * 12)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setPickerMode(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const cellDate = (day: number) => localDateStr(viewYear, viewMonth, day)
  const isDisabled = (ds: string) => ds > maxStr || !!(min && ds < min)
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di']
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear
    if (new Date(ny, nm, 1) > new Date(maxStr + 'T23:59:59')) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else { setViewMonth(m => m+1) }
  }
  const label = value
    ? new Date(value+'T12:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Choisir une date'
  const BtnCls = 'w-6 h-6 flex items-center justify-center rounded hover:bg-[#F5F3EF] dark:hover:bg-[#253040] text-[#5C6880] transition-colors'
  const baseCls = 'w-full bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC] focus:outline-none'
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setPickerMode(null) }}
        className={`${baseCls} flex items-center gap-2 text-left transition-colors ${open ? 'ring-2 ring-[#14B8A6] border-transparent' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#9E9A93]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className={value ? 'text-[#1B3050] dark:text-[#E8E4DC]' : 'text-[#9E9A93]'}>{label}</span>
      </button>
      {open && (
        <div className="mt-1.5 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-md p-3 w-full select-none">
          <div className="flex items-center justify-between mb-2.5">
            {pickerMode === null && (
              <button type="button" onClick={prevMonth} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {pickerMode === 'month' && (
              <button type="button" onClick={() => setPickerMode(null)} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {pickerMode === 'year' && (
              <button type="button" onClick={() => setYearPage(p => p - 12)} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div className="flex items-center gap-1">
              {pickerMode === 'year' ? (
                <span className="text-xs font-semibold text-[#1B3050] dark:text-white tracking-wide">{yearPage} – {yearPage + 11}</span>
              ) : (
                <>
                  <button type="button" onClick={() => setPickerMode(m => m === 'month' ? null : 'month')}
                    className={`text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded transition-colors ${(pickerMode as string) === 'month' ? 'bg-[#14B8A6] text-white' : 'text-[#1B3050] dark:text-white hover:bg-[#F5F3EF] dark:hover:bg-[#253040]'}`}>
                    {MONTHS_FR[viewMonth]}
                  </button>
                  <button type="button" onClick={() => { setPickerMode(m => m === 'year' ? null : 'year'); setYearPage(Math.floor(viewYear / 12) * 12) }}
                    className={`text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded transition-colors ${(pickerMode as string) === 'year' ? 'bg-[#14B8A6] text-white' : 'text-[#1B3050] dark:text-white hover:bg-[#F5F3EF] dark:hover:bg-[#253040]'}`}>
                    {viewYear}
                  </button>
                </>
              )}
            </div>
            {pickerMode === null && (
              <button type="button" onClick={nextMonth} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {pickerMode === 'month' && <span className="w-6"/>}
            {pickerMode === 'year' && (
              <button type="button" onClick={() => { if (yearPage + 12 <= maxYear) setYearPage(p => p + 12) }} className={BtnCls} disabled={yearPage + 12 > maxYear}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
          {pickerMode === 'month' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((m, i) => {
                const firstOfMonth = localDateStr(viewYear, i, 1)
                const daysInM = new Date(viewYear, i+1, 0).getDate()
                const lastOfMonth = localDateStr(viewYear, i, daysInM)
                const allDisabled = lastOfMonth < (min || '0000') || firstOfMonth > maxStr
                const isActive = i === viewMonth
                return (
                  <button type="button" key={i} disabled={allDisabled}
                    onClick={() => { setViewMonth(i); setPickerMode(null) }}
                    className={[
                      'h-8 rounded-sm text-[11px] font-medium transition-colors',
                      isActive ? 'bg-[#14B8A6] text-white' : '',
                      !isActive && !allDisabled ? 'hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                      allDisabled ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : '',
                    ].join(' ')}>
                    {m}
                  </button>
                )
              })}
            </div>
          )}
          {pickerMode === 'year' && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({length: 12}).map((_, i) => {
                const y = yearPage + i
                const isFuture = y > maxYear
                const tooOld = min ? y < new Date(min).getFullYear() : false
                const disabled = isFuture || tooOld
                const isActive = y === viewYear
                return (
                  <button type="button" key={y} disabled={disabled}
                    onClick={() => { setViewYear(y); setPickerMode(null) }}
                    className={[
                      'h-8 rounded-sm text-[11px] font-medium transition-colors',
                      isActive ? 'bg-[#14B8A6] text-white' : '',
                      !isActive && !disabled ? 'hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                      disabled ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : '',
                    ].join(' ')}>
                    {y}
                  </button>
                )
              })}
            </div>
          )}
          {pickerMode === null && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_FR.map(d => <span key={d} className="text-center text-[9px] font-semibold text-[#9E9A93] py-0.5">{d}</span>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({length: startOffset}).map((_, i) => <span key={`e${i}`}/>)}
                {Array.from({length: daysInMonth}).map((_, i) => {
                  const day = i + 1
                  const ds = cellDate(day)
                  const disabled = isDisabled(ds)
                  const isSelected = ds === value
                  const isToday = ds === todayStr
                  return (
                    <button type="button" key={day} disabled={disabled}
                      onClick={() => { if (!disabled) { onChange(ds); setOpen(false) } }}
                      className={[
                        'text-center text-[11px] h-7 w-full rounded-full transition-colors leading-none',
                        isSelected ? 'bg-[#14B8A6] text-white font-bold' : '',
                        !isSelected && !disabled ? 'hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                        isToday && !isSelected ? 'font-bold text-[#14B8A6] dark:text-[#7FC5B0]' : '',
                        disabled ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DateRangePicker({
  dateFrom, dateTo,
  onFromChange, onToChange
}: {
  dateFrom: string; dateTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [pickerMode, setPickerMode] = React.useState<null | 'month' | 'year'>(null)
  // Timezone-safe: on construit la chaîne depuis les composantes locales,
  // new Date(y,m,d).toISOString() donnerait le jour précédent en UTC+2.
  const localDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const todayLocal = new Date()
  const todayStr = localDateStr(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
  const todayYear = todayLocal.getFullYear()
  const parseRef = (s: string | undefined) => s ? { y: parseInt(s.slice(0,4)), m: parseInt(s.slice(5,7))-1 } : { y: todayLocal.getFullYear(), m: todayLocal.getMonth() }
  const refDate = dateTo || dateFrom
  const [viewYear, setViewYear] = React.useState(() => parseRef(refDate).y)
  const [viewMonth, setViewMonth] = React.useState(() => parseRef(refDate).m)
  const [yearPage, setYearPage] = React.useState(() => Math.floor(parseRef(refDate).y / 12) * 12)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setPickerMode(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const cellDate = (day: number) => localDateStr(viewYear, viewMonth, day)
  const handleDayClick = (ds: string) => {
    if (!dateFrom || (dateFrom && dateTo)) {
      onFromChange(ds); onToChange('')
    } else {
      if (ds < dateFrom) { onFromChange(ds); onToChange('') }
      else {
        const diff = (new Date(ds).getTime() - new Date(dateFrom).getTime()) / 86400000
        if (diff > 60) return
        onToChange(ds); setOpen(false)
      }
    }
  }
  const isDisabled = (ds: string) => {
    if (ds > todayStr) return true
    if (dateFrom && !dateTo) {
      const diff = (new Date(ds).getTime() - new Date(dateFrom).getTime()) / 86400000
      if (diff > 60) return true
    }
    return false
  }
  const isInRange = (ds: string) => {
    const to = dateTo || hovered
    if (!dateFrom || !to) return false
    const mn = dateFrom < to ? dateFrom : to
    const mx = dateFrom < to ? to : dateFrom
    return ds > mn && ds < mx
  }
  const isStart = (ds: string) => ds === dateFrom
  const isEnd = (ds: string) => !!(dateTo || hovered) && ds === (dateTo || hovered)
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di']
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear
    if (new Date(ny, nm, 1) > todayLocal) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else { setViewMonth(m => m+1) }
  }
  const label = dateFrom && dateTo
    ? `${new Date(dateFrom+'T12:00:00').toLocaleDateString('fr-CH',{day:'numeric',month:'short'})} – ${new Date(dateTo+'T12:00:00').toLocaleDateString('fr-CH',{day:'numeric',month:'short'})}`
    : dateFrom ? `${new Date(dateFrom+'T12:00:00').toLocaleDateString('fr-CH',{day:'numeric',month:'short'})} → …`
    : 'Choisir les dates'
  const BtnCls = 'w-6 h-6 flex items-center justify-center rounded hover:bg-[#F5F3EF] dark:hover:bg-[#253040] text-[#5C6880] transition-colors'
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(o => !o); setPickerMode(null) }}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${open || (dateFrom && dateTo) ? 'border-[#14B8A6] bg-[#EEF7F3] dark:bg-[#152920] text-[#14B8A6]' : 'border-[#DDD9D1] dark:border-[#323B4A] bg-[#F5F3EF] dark:bg-[#1E2530] text-[#5C6880] dark:text-[#9E9A93]'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className="font-medium">{label}</span>
        {(dateFrom || dateTo) && (
          <span onClick={e => { e.stopPropagation(); onFromChange(''); onToChange('') }}
            className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#14B8A6] bg-opacity-20 text-[#14B8A6] hover:bg-opacity-40 text-[9px] leading-none">✕</span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-xl p-3 w-60 select-none">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-2.5">
            {pickerMode === null && (
              <button onClick={prevMonth} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {pickerMode === 'month' && (
              <button onClick={() => setPickerMode(null)} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {pickerMode === 'year' && (
              <button onClick={() => { setYearPage(p => p - 12) }} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div className="flex items-center gap-1">
              {pickerMode === 'year' ? (
                <span className="text-xs font-semibold text-[#1B3050] dark:text-white tracking-wide">{yearPage} – {yearPage + 11}</span>
              ) : (
                <>
                  <button onClick={() => setPickerMode(m => m === 'month' ? null : 'month')}
                    className={`text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded transition-colors ${(pickerMode as string) === 'month' ? 'bg-[#14B8A6] text-white' : 'text-[#1B3050] dark:text-white hover:bg-[#F5F3EF] dark:hover:bg-[#253040]'}`}>
                    {MONTHS_FR[viewMonth]}
                  </button>
                  <button onClick={() => { setPickerMode(m => m === 'year' ? null : 'year'); setYearPage(Math.floor(viewYear / 12) * 12) }}
                    className={`text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded transition-colors ${(pickerMode as string) === 'year' ? 'bg-[#14B8A6] text-white' : 'text-[#1B3050] dark:text-white hover:bg-[#F5F3EF] dark:hover:bg-[#253040]'}`}>
                    {viewYear}
                  </button>
                </>
              )}
            </div>
            {pickerMode === null && (
              <button onClick={nextMonth} className={BtnCls}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {pickerMode === 'month' && <span className="w-6"/>}
            {pickerMode === 'year' && (
              <button onClick={() => { if (yearPage + 12 <= todayYear) setYearPage(p => p + 12) }} className={BtnCls} disabled={yearPage + 12 > todayYear}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>

          {/* ── Month picker ── */}
          {pickerMode === 'month' && (
            <div className="grid grid-cols-3 gap-1 mb-1">
              {MONTHS_SHORT.map((m, i) => {
                const isFuture = new Date(viewYear, i, 1) > todayLocal
                const isActive = i === viewMonth
                return (
                  <button key={i} disabled={isFuture}
                    onClick={() => { setViewMonth(i); setPickerMode(null) }}
                    className={[
                      'h-8 rounded-sm text-[11px] font-medium transition-colors',
                      isActive ? 'bg-[#14B8A6] text-white' : '',
                      !isActive && !isFuture ? 'hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                      isFuture ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : '',
                    ].join(' ')}>
                    {m}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Year picker ── */}
          {pickerMode === 'year' && (
            <div className="grid grid-cols-3 gap-1 mb-1">
              {Array.from({length: 12}).map((_, i) => {
                const y = yearPage + i
                const isFuture = y > todayYear
                const isActive = y === viewYear
                return (
                  <button key={y} disabled={isFuture}
                    onClick={() => { setViewYear(y); setPickerMode(null) }}
                    className={[
                      'h-8 rounded-sm text-[11px] font-medium transition-colors',
                      isActive ? 'bg-[#14B8A6] text-white' : '',
                      !isActive && !isFuture ? 'hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                      isFuture ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : '',
                    ].join(' ')}>
                    {y}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Day calendar ── */}
          {pickerMode === null && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_FR.map(d => <span key={d} className="text-center text-[9px] font-semibold text-[#9E9A93] py-0.5">{d}</span>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({length: startOffset}).map((_, i) => <span key={`e${i}`}/>)}
                {Array.from({length: daysInMonth}).map((_, i) => {
                  const day = i + 1
                  const ds = cellDate(day)
                  const disabled = isDisabled(ds)
                  const start = isStart(ds)
                  const end = isEnd(ds)
                  const inRange = isInRange(ds)
                  const isToday = ds === todayStr
                  return (
                    <button key={day}
                      disabled={disabled}
                      onMouseEnter={() => { if (dateFrom && !dateTo && !disabled) setHovered(ds) }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => !disabled && handleDayClick(ds)}
                      className={[
                        'text-center text-[11px] h-7 w-full transition-colors leading-none',
                        start && end ? 'rounded-full bg-[#14B8A6] text-white font-bold' : '',
                        start && !end ? 'rounded-l-full bg-[#14B8A6] text-white font-bold' : '',
                        !start && end ? 'rounded-r-full bg-[#14B8A6] text-white font-bold' : '',
                        inRange && !start && !end ? 'bg-[#D4EDE6] dark:bg-[#173328] text-[#14B8A6] dark:text-[#7FC5B0]' : '',
                        !start && !end && !inRange && !disabled ? 'rounded-full hover:bg-[#EEF7F3] dark:hover:bg-[#1a2d26] text-[#1B3050] dark:text-[#E8E4DC]' : '',
                        isToday && !start && !end ? 'font-bold text-[#14B8A6] dark:text-[#7FC5B0]' : '',
                        disabled ? 'text-[#D0CBC2] dark:text-[#2e3f4f] cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="mt-2 pt-2 border-t border-[#EDE9E1] dark:border-[#2A3240]">
            <p className="text-[9px] text-[#9E9A93] text-center leading-tight">
              {!dateFrom ? 'Cliquez pour choisir le début' : !dateTo ? 'Cliquez pour choisir la fin (max 60 jours)' : `${Math.round((new Date(dateTo+'T12:00:00').getTime()-new Date(dateFrom+'T12:00:00').getTime())/86400000)+1} jours sélectionnés`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse' | 'cloturees'>('positions')
  const [allocTab, setAllocTab] = useState<'positions' | 'categorie'>('categorie')
  const [chartMode, setChartMode] = useState<'evol' | 'pnl' | 'drawdown'>('evol')
  const [chartRange, setChartRange] = useState<'all' | '60d' | 'weekly'>('all')
  const [chartDateFrom, setChartDateFrom] = useState('')
  const [chartDateTo, setChartDateTo] = useState('')
  const [chartBustKey, setChartBustKey] = useState(0)
  const [timePeriod, setTimePeriod] = useState<'1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max'>('Max')
  const [chartInterval, setChartInterval] = useState<'1day' | '1h' | '4h' | '5min'>('1day')
  const [chartDownsample, setChartDownsample] = useState(1)
  const [maxDrawdown, setMaxDrawdown] = useState<{ pct: number; date: string } | null>(null)
  const [dailyMaxDrawdown, setDailyMaxDrawdown] = useState<{ pct: number; peakDate: string; date: string } | null>(null)

  // ── helper : convert timePeriod button → range + dateFrom ──────────────
  const applyTimePeriod = (p: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max') => {
    setTimePeriod(p)
    const today = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (p === 'Max') {
      // Intervalle adaptatif selon la durée du portefeuille
      const sorted = positionsCalc.filter(q => q.quantite > 0).sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
      const firstDate = sorted[0]?.dateAchat
      if (firstDate) {
        const spanDays = (today.getTime() - new Date(firstDate).getTime()) / (1000 * 3600 * 24)
        if (spanDays < 1) {
          // < 1 jour → 5min, pas de downsample
          setChartRange('60d'); setChartInterval('5min')
          setChartDateFrom(fmt(today)); setChartDateTo(fmt(today))
          setChartDownsample(1)
        } else if (spanDays < 7) {
          // 1j–1 semaine → 1h, pas de downsample
          setChartRange('60d'); setChartInterval('1h')
          setChartDateFrom(firstDate); setChartDateTo(fmt(today))
          setChartDownsample(1)
        } else if (spanDays < 30) {
          // 1 semaine–1 mois → 4h
          setChartRange('60d'); setChartInterval('4h')
          setChartDateFrom(firstDate); setChartDateTo(fmt(today))
          setChartDownsample(1)
        } else if (spanDays < 365) {
          // 1 mois–1 an → 1day sans downsample
          setChartRange('60d'); setChartInterval('1day')
          setChartDateFrom(firstDate); setChartDateTo(fmt(today))
          setChartDownsample(1)
        } else {
          // > 1 an → 1day avec downsample selon les années (2j/1an, 3j/2ans, ...)
          const years = Math.floor(spanDays / 365)
          setChartRange('60d'); setChartInterval('1day')
          setChartDateFrom(firstDate); setChartDateTo(fmt(today))
          setChartDownsample(years + 1)
        }
      } else {
        setChartRange('60d'); setChartInterval('1day')
        setChartDateFrom(''); setChartDateTo(fmt(today))
        setChartDownsample(1)
      }
    } else if (p === '1D') {
      // 5min : aujourd'hui seulement (de minuit à maintenant), prémarket inclus si dispo
      setChartRange('60d'); setChartInterval('5min')
      setChartDateFrom(fmt(today)); setChartDateTo(fmt(today))
      setChartDownsample(1)
    } else if (p === '1W') {
      // 1h : 7 derniers jours calendaires, prémarket inclus
      const d = new Date(today); d.setDate(d.getDate() - 7)
      setChartRange('60d'); setChartInterval('1h')
      setChartDateFrom(fmt(d)); setChartDateTo(fmt(today))
      setChartDownsample(1)
    } else if (p === '1M') {
      // 4h : dernier mois calendaire
      const d = new Date(today); d.setMonth(d.getMonth() - 1)
      setChartRange('60d'); setChartInterval('4h')
      setChartDateFrom(fmt(d)); setChartDateTo(fmt(today))
      setChartDownsample(1)
    } else if (p === 'YTD') {
      // 1day : depuis le 1er janvier de l'année civile
      const d = new Date(today.getFullYear(), 0, 1)
      setChartRange('60d'); setChartInterval('1day')
      setChartDateFrom(fmt(d)); setChartDateTo(fmt(today))
      setChartDownsample(1)
    } else if (p === '1Y') {
      // 1day : dernière année calendaire
      const d = new Date(today); d.setFullYear(d.getFullYear() - 1)
      setChartRange('60d'); setChartInterval('1day')
      setChartDateFrom(fmt(d)); setChartDateTo(fmt(today))
      setChartDownsample(1)
    }
  }
  // Re-apply time period on mount — handles HMR state preservation (Next.js hot reload)
  // When code changes, React preserves state, so chartDateFrom may reflect an old period.
  const maxInitDone = useRef(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (timePeriod !== 'Max') applyTimePeriod(timePeriod) }, [])
  const [dailyMDDLoading, setDailyMDDLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Position, 'id'>>(EMPTY_FORM)
  // Slice mode (modifier en créant une tranche)
  const [sliceMode, setSliceMode] = useState(false)
  const [sliceDate, setSliceDate] = useState('')
  const [sliceQuantiteRaw, setSliceQuantiteRaw] = useState('')
  const [sliceQuantite, setSliceQuantite] = useState(0)
  const [sliceGroupTotal, setSliceGroupTotal] = useState(0)  // total du groupe (tous lots) au moment de l'ouverture
  const [groupHasSlices, setGroupHasSlices] = useState(false) // true si le groupe a déjà des ajouts/réductions
  const [formTickerMinDate, setFormTickerMinDate] = useState<string | undefined>(undefined) // première date dispo dans l'historique de l'actif sélectionné
  const [slicePrixVenteRaw, setSlicePrixVenteRaw] = useState('')
  const [slicePrixVente, setSlicePrixVente] = useState<number | undefined>(undefined)
  const [sliceHistoPrice, setSliceHistoPrice] = useState<{ price: number; fxRate: number } | null>(null)
  const [sliceHistoLoading, setSliceHistoLoading] = useState(false)
  // Modale de suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null)
  const [deleteMode, setDeleteMode] = useState<'permanent' | 'close'>('permanent')
  const [deleteCloseDate, setDeleteCloseDate] = useState('')
  const [deleteHistoPrice, setDeleteHistoPrice] = useState<{ price: number; fxRate: number } | null>(null)
  const [deleteHistoLoading, setDeleteHistoLoading] = useState(false)
  const [quantiteRaw, setQuantiteRaw] = useState('')  // string pour permettre la saisie de 0.00001
  const [quantiteError, setQuantiteError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  // Prix temps réel (fetchPriceCached) pour la section positions
  const [livePricesMap, setLivePricesMap] = useState<Map<string, { price: number; fxRate: number }>>(new Map())
  const [fetchingModal, setFetchingModal] = useState(false)
  const [fetchModalError, setFetchModalError] = useState<string | null>(null)
  const [fetchingAchat, setFetchingAchat] = useState(false)
  const [manuel, setManuel] = useState(false)
  const [profile, setProfile] = useState<InvProfile>({
    horizon: 10,
    loss: 25,
    liquidity: 'moyenne',
    objective: 'modéré',
  })
  const [userId, setUserId] = useState<string | null>(null)

  // Profil courtier actif (basé sur form.courtier)
  const brokerProfile = form.courtier ? BROKER_PROFILES[form.courtier] : null

  // Types Yahoo Finance par catégorie
  const CATEGORY_TYPES: Record<string, string[]> = {
    'Actions':            ['EQUITY'],
    'ETF':                ['ETF'],
    'Fonds':              ['ETF', 'MUTUALFUND', 'BOND'],
    'Matières premières': ['FUTURE'],
    'Crypto':             ['CRYPTOCURRENCY'],
    'Forex':              ['CURRENCY', 'COMMODITY'],
    'Tout':               [], // pas de filtre
  }

  // Filtre effectif = intersection courtier ∩ catégorie
  // undefined = aucun filtre (tout afficher) | [] = combinaison impossible | [...] = filtre actif
  const categoryTypes = CATEGORY_TYPES[form.categorie] ?? []
  const brokerTypes   = brokerProfile?.types ?? []
  const effectiveTypes: string[] | undefined = (() => {
    const catEmpty = categoryTypes.length === 0
    const brkEmpty = brokerTypes.length === 0
    if (catEmpty && brkEmpty) return undefined        // ni courtier ni catégorie → tout
    if (catEmpty) return brokerTypes                  // courtier seul
    if (brkEmpty) return categoryTypes               // catégorie seule
    return categoryTypes.filter(t => brokerTypes.includes(t)) // intersection (peut être [])
  })()

  // ── Chargement : Supabase si connecté, localStorage sinon ───────────────────
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          // Positions
          const { data: rows } = await supabase
            .from('portfolio_positions')
            .select('*')
            .eq('user_id', user.id)
          if (rows && rows.length > 0) {
            setPositions(rows.map((r: Record<string, unknown>) => ({
              id: r.id as string,
              nom: r.nom as string,
              ticker: r.ticker as string,
              categorie: r.categorie as string,
              devise: r.devise as string,
              quantite: Number(r.quantite),
              prixAchat: Number(r.prix_achat),
              tauxAchatCHF: Number(r.taux_achat_chf),
              dateAchat: r.date_achat as string,
              prixActuel: Number(r.prix_actuel),
              tauxActuelCHF: Number(r.taux_actuel_chf),
              courtier: (r.courtier as string) ?? undefined,
              derniereMaj: (r.derniere_maj as string) ?? undefined,
              dateVente: (r.date_vente as string) ?? undefined,
              prixVente: r.prix_vente !== undefined && r.prix_vente !== null ? Number(r.prix_vente) : undefined,
              tauxVenteCHF: r.taux_vente_chf !== undefined && r.taux_vente_chf !== null ? Number(r.taux_vente_chf) : undefined,
            })))
          } else {
            // Fallback localStorage si Supabase est vide
            try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
          }
          // Profil investisseur
          const { data: prof } = await supabase
            .from('investor_profile')
            .select('*')
            .eq('user_id', user.id)
            .single()
          if (prof) {
            setProfile({
              horizon: Number(prof.horizon),
              loss: Number(prof.loss) as 10 | 20 | 30 | 40 | 50,
              liquidity: prof.liquidity as 'haute' | 'moyenne' | 'faible',
              objective: (prof.objective === 'défensif' ? 'inflation' : prof.objective) as 'inflation' | 'modéré' | 'croissance' | 'agressif',
            })
          }
        } else {
          // Non connecté : localStorage
          try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
        }
      } catch {
        try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
      }
    }
    init()
  }, [])
  useEffect(() => {
    if (userId) return // connecté : Supabase gère (étape suivante)
    try { localStorage.setItem('finveria_portfolio', JSON.stringify(positions)) } catch {}
  }, [positions, userId])

  // ── Purge automatique des lots avec quantité = 0 (créés avant la validation) ─
  const purgeDoneRef = useRef(false)
  useEffect(() => {
    if (purgeDoneRef.current || positions.length === 0) return
    const zeros = positions.filter(p => p.quantite === 0)
    if (zeros.length === 0) { purgeDoneRef.current = true; return }
    purgeDoneRef.current = true
    setPositions(ps => ps.filter(p => p.quantite !== 0))
    if (userId) {
      const supabase = createClient()
      zeros.forEach(z => { supabase.from('portfolio_positions').delete().eq('id', z.id).eq('user_id', userId).then(() => {}) })
    }
  }, [positions, userId])

  // ── Positions actives (non fermées) — pour affichage + stats ────────────────
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentPositions = useMemo(
    () => positions.filter(p => !p.dateVente || p.dateVente >= todayStr),
    [positions, todayStr]
  )

  // ── Refresh global — 1 seul appel batch /api/history au lieu de N appels /api/prices ──
  async function refreshPrices() {
    setRefreshing(true); setRefreshError(null)
    const active = currentPositions.filter(p => p.ticker.trim())
    if (active.length === 0) { setRefreshing(false); return }

    // Collecte les tickers uniques + paires FX nécessaires
    const tickerSet = new Set<string>()
    active.forEach(p => {
      tickerSet.add(p.ticker.trim().toUpperCase())
      if (p.devise !== 'CHF') tickerSet.add(`${p.devise}CHF=X`)
    })
    const tickersStr = Array.from(tickerSet).join(',')

    // Invalide priceCache MAINTENANT (synchrone) pour que le re-rendu du chart
    // déclenché par setChartBustKey trouve le cache vide et fetche des prix frais
    for (const p of active) {
      priceCache.delete(`${p.ticker}|${p.devise}|now`)
      priceCache.delete(`${p.ticker.toUpperCase()}|${p.devise}|now`)
    }

    let histData: Record<string, HistEntry> = {}
    try {
      // Passe bust=true : invalide le cache par ticker et force un rafraîchissement
      // Les charts profitent immédiatement des données fraîches via le cache partagé
      histData = await fetchHistory(tickersStr, true, '1day')
    } catch {
      setRefreshError('Impossible de récupérer les prix.'); setRefreshing(false); return
    }
    if (Object.keys(histData).length === 0) {
      setRefreshError('Impossible de récupérer les prix.'); setRefreshing(false); return
    }

    // Récupère les taux FX manquants via /api/prices (fallback si le batch history ne les a pas)
    const nonChfDevises = [...new Set(active.filter(p => p.devise !== 'CHF').map(p => p.devise))]
    const missingFxDevises = nonChfDevises.filter(dev => {
      const hFx = histData[`${dev}CHF=X`]
      return !hFx || hFx.closes.length === 0
    })
    const fallbackFxRates = new Map<string, number>()
    if (missingFxDevises.length > 0) {
      await Promise.all(missingFxDevises.map(async dev => {
        try {
          const res = await fetch(`/api/prices?ticker=${encodeURIComponent(dev + '/CHF')}&devise=CHF`)
          if (res.ok) { const d = await res.json(); if (d.price != null) fallbackFxRates.set(dev, d.price) }
        } catch {}
      }))
    }

    let errCount = 0
    const updated = active.map(p => {
      const key = p.ticker.trim().toUpperCase()
      const h = histData[key]
      const fxKey = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
      const hFx = fxKey ? histData[fxKey.toUpperCase()] : null
      if (!h || h.closes.length === 0) { errCount++; return p }
      const prixActuel = h.closes[h.closes.length - 1]
      const fxRate = hFx && hFx.closes.length > 0
        ? hFx.closes[hFx.closes.length - 1]
        : (p.devise !== 'CHF' ? (fallbackFxRates.get(p.devise) ?? p.tauxActuelCHF) : 1)
      return { ...p, prixActuel, tauxActuelCHF: fxRate, derniereMaj: new Date().toISOString() }
    })

    // Fusionne les positions mises à jour dans la liste complète (préserve les positions fermées)
    const updatedMap = new Map(updated.map(p => [p.id, p]))
    setPositions(ps => ps.map(p => updatedMap.has(p.id) ? updatedMap.get(p.id)! : p))
    if (userId) {
      const supabase = createClient()
      await Promise.all(updated.map(p => supabase.from('portfolio_positions').update({
        prix_actuel: p.prixActuel, taux_actuel_chf: p.tauxActuelCHF, derniere_maj: p.derniereMaj ?? null,
      }).eq('id', p.id).eq('user_id', userId)))
    }

    // Synchronise livePricesMap via fetchPriceCached (même source que EvolChart "Maintenant")
    // → positions ouvertes, allocation et PnL affichent exactement les mêmes prix temps réel
    const liveEntries = await Promise.all(active.map(async p => {
      const d = await fetchPriceCached(p.ticker, p.devise, undefined)
      return { key: `${p.ticker.toUpperCase()}|${p.devise}`, data: d }
    }))
    setLivePricesMap(prev => {
      const next = new Map(prev)
      for (const e of liveEntries) {
        if (e.data) next.set(e.key, e.data)
      }
      return next
    })

    if (errCount > 0) setRefreshError(`${errCount} position(s) non mises à jour.`)
    setRefreshing(false)
  }

  // ── Fetch prix actuel (params explicites pour déclencher sans attendre setState) ──
  async function fetchPrixActuelFor(ticker: string, devise: string) {
    if (!ticker.trim()) return
    setFetchingModal(true); setFetchModalError(null)
    try {
      const data = await fetchPriceCached(ticker, devise, undefined)
      if (data?.price != null) setForm(f => ({ ...f, prixActuel: data.price, tauxActuelCHF: data.fxRate ?? 1 }))
    } catch {}
    finally { setFetchingModal(false) }
  }

  // ── Fetch prix historique (ou temps réel si date = aujourd'hui) ─────────────
  async function fetchPrixAchatFor(ticker: string, devise: string, date: string) {
    if (!ticker.trim() || !date) return
    setFetchingAchat(true); setFetchModalError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const dateParam = date >= today ? undefined : date
      const data = await fetchPriceCached(ticker, devise, dateParam)
      if (data?.price != null) setForm(f => ({ ...f, prixAchat: data.price, tauxAchatCHF: data.fxRate ?? 1 }))
    } catch {}
    finally { setFetchingAchat(false) }
  }

  // ── Calculs ─────────────────────────────────────────────────────────────────
  // ── Auto-fetch prix live pour la section positions ─────────────────────────
  useEffect(() => {
    const activeLongs = currentPositions.filter(p => p.quantite > 0 && !p.dateVente)
    if (activeLongs.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(activeLongs.map(async p => {
        const d = await fetchPriceCached(p.ticker, p.devise, undefined)
        return { key: `${p.ticker.toUpperCase()}|${p.devise}`, data: d }
      }))
      if (cancelled) return
      const map = new Map<string, { price: number; fxRate: number }>()
      for (const e of entries) { if (e.data) map.set(e.key, e.data) }
      setLivePricesMap(map)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPositions.map(p => p.id + p.quantite).join(',')])

  const positionsCalc: PositionCalc[] = useMemo(() => currentPositions.map(p => {
    // Pour les ventes (quantite < 0, prixVente renseigné) :
    //   cout  = |qty| × prixAchat × tauxAchat       (positif : ce qu'on a payé à l'achat)
    //   valeur= |qty| × prixVente × tauxVente        (positif : ce qu'on a encaissé à la vente)
    //   gain  = valeur − cout                        (réalisé, positif si profitable)
    const absQty = Math.abs(p.quantite)
    const isSale = p.quantite < 0 && p.prixVente != null
    // Prix live si disponible (fetchPriceCached), sinon prixActuel stocké
    const liveKey = `${p.ticker.toUpperCase()}|${p.devise}`
    const live = livePricesMap.get(liveKey)
    const prixLive = live?.price ?? p.prixActuel
    const tauxLive = live?.fxRate ?? p.tauxActuelCHF
    const coutCHF = isSale
      ? absQty * p.prixAchat * p.tauxAchatCHF
      : p.quantite * p.prixAchat * p.tauxAchatCHF
    const valeurCHF = isSale
      ? absQty * p.prixVente! * (p.tauxVenteCHF ?? p.tauxAchatCHF)
      : p.quantite * prixLive * tauxLive
    const gainCHF = valeurCHF - coutCHF
    const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
    const gainDevise = isSale
      ? absQty * (p.prixVente! - p.prixAchat)
      : p.quantite * (prixLive - p.prixAchat)
    const gainPctDevise = p.prixAchat > 0 ? ((prixLive - p.prixAchat) / p.prixAchat) * 100 : 0
    const impactFX = p.devise === 'CHF' ? 0
      : isSale
        ? absQty * p.prixVente! * ((p.tauxVenteCHF ?? p.tauxAchatCHF) - p.tauxAchatCHF)
        : p.quantite * prixLive * (tauxLive - p.tauxAchatCHF)
    const inflation = inflationCumulee(p.dateAchat)
    const gainReel = gainCHF - coutCHF * inflation
    const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
    return { ...p, prixActuel: isSale ? p.prixActuel : prixLive, tauxActuelCHF: isSale ? p.tauxActuelCHF : tauxLive, coutCHF, valeurCHF, gainCHF, gainPctCHF, gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel }
  }), [currentPositions, livePricesMap])

  // Toutes les positions (y compris vendues dans le passé) — pour PnL par période
  // Les positions fermées ont isSale=true et utilisent prixVente → gainCHF réalisé correct
  const allPositionsCalc: PositionCalc[] = useMemo(() => positions.map(p => {
    const absQty = Math.abs(p.quantite)
    const isSale = p.quantite < 0 && p.prixVente != null
    const liveKey = `${p.ticker.toUpperCase()}|${p.devise}`
    const live = livePricesMap.get(liveKey)
    const prixLive = live?.price ?? p.prixActuel
    const tauxLive = live?.fxRate ?? p.tauxActuelCHF
    const coutCHF = isSale ? absQty * p.prixAchat * p.tauxAchatCHF : p.quantite * p.prixAchat * p.tauxAchatCHF
    const valeurCHF = isSale ? absQty * p.prixVente! * (p.tauxVenteCHF ?? p.tauxAchatCHF) : p.quantite * prixLive * tauxLive
    const gainCHF = valeurCHF - coutCHF
    const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
    const gainDevise = isSale ? absQty * (p.prixVente! - p.prixAchat) : p.quantite * (prixLive - p.prixAchat)
    const gainPctDevise = p.prixAchat > 0 ? ((prixLive - p.prixAchat) / p.prixAchat) * 100 : 0
    const impactFX = p.devise === 'CHF' ? 0 : isSale ? absQty * p.prixVente! * ((p.tauxVenteCHF ?? p.tauxAchatCHF) - p.tauxAchatCHF) : p.quantite * prixLive * (tauxLive - p.tauxAchatCHF)
    const inflation = inflationCumulee(p.dateAchat)
    const gainReel = gainCHF - coutCHF * inflation
    const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
    return { ...p, prixActuel: isSale ? p.prixActuel : prixLive, tauxActuelCHF: isSale ? p.tauxActuelCHF : tauxLive, coutCHF, valeurCHF, gainCHF, gainPctCHF, gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel }
  }), [positions, livePricesMap])

  // Fix F5 reload: applyTimePeriod('Max') needs positionsCalc (defined above).
  // Fires when positionsCalc first becomes non-empty (positions loaded from Supabase).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timePeriod !== 'Max' || positionsCalc.length === 0 || maxInitDone.current) return
    maxInitDone.current = true
    applyTimePeriod('Max')
  }, [positionsCalc.length])

  const totals = useMemo(() => {
    // Regrouper par ticker pour appliquer la même logique FIFO que l'onglet Positions
    const grp: Record<string, typeof positionsCalc> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (grp[k] ??= []).push(p) }

    let coutTotal = 0, valeurTotal = 0, fxTotal = 0, gainReelTotal = 0
    for (const group of Object.values(grp)) {
      const gQteNet = group.reduce((s, p) => s + p.quantite, 0)
      if (gQteNet <= 0) continue  // ticker entièrement vendu → exclure des totaux ouverts
      const longsGroup = group.filter(p => p.quantite > 0)
      const first = longsGroup[0] ?? group[0]  // Pour champs non-prix (nom, devise, dateAchat)
      // Référence de prix = lot le plus récemment rafraîchi (même actif = même prix courant)
      const priceRef = longsGroup.reduce(
        (best, p) => ((p.derniereMaj ?? '') >= (best.derniereMaj ?? '') ? p : best),
        longsGroup[0] ?? group[0]
      )
      // Valeur actuelle = quantité nette × prix actuel
      const gVal   = gQteNet * priceRef.prixActuel * priceRef.tauxActuelCHF
      valeurTotal += gVal
      // Coût net CHF (longs − réductions FIFO)
      const gCout  = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
      coutTotal   += gCout
      // Impact FX sur position nette : taux moyen pondéré à l'achat = gCout / gCoutDevise
      // Coût en devise = coût net de la position ouverte (longs FIFO nets)
      const gCoutDevise = longsGroup.reduce((s, p) => s + p.quantite * p.prixAchat, 0) - group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s, q) => s + Math.abs(q.quantite) * q.prixAchat, 0)
      const gWgtBuyRate = priceRef.devise !== 'CHF' && gCoutDevise > 0 ? gCout / gCoutDevise : first.tauxAchatCHF
      fxTotal      += priceRef.devise === 'CHF' ? 0 : gQteNet * priceRef.prixActuel * (priceRef.tauxActuelCHF - gWgtBuyRate)
      // Gain réel = gain CHF net − inflation sur coût net (depuis premier achat)
      gainReelTotal += (gVal - gCout) - gCout * inflationCumulee(first.dateAchat)
    }

    const gainTotal = valeurTotal - coutTotal
    const gainPct = coutTotal > 0 ? (gainTotal / coutTotal) * 100 : 0
    const gainReelPct = coutTotal > 0 ? (gainReelTotal / coutTotal) * 100 : 0
    const inflationErosionTotal = gainTotal - gainReelTotal

    return { coutTotal, valeurTotal, gainTotal, gainPct, fxTotal, gainReelTotal, gainReelPct, inflationErosionTotal }
  }, [positionsCalc])

  // ── Groupement par ticker ────────────────────────────────────────────────────
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())
  const groupOrder = useMemo(() => {
    const seen: string[] = []
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); if (!seen.includes(k)) seen.push(k) }
    // Exclure les tickers dont la quantité nette est nulle (lot entièrement vendu)
    const grpTmp: Record<string, typeof positionsCalc> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (grpTmp[k] ??= []).push(p) }
    return seen.filter(k => grpTmp[k].reduce((s, p) => s + p.quantite, 0) > 0)
  }, [positionsCalc])
  const groupedPositions = useMemo(() => {
    const g: Record<string, PositionCalc[]> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (g[k] ??= []).push(p) }
    return g
  }, [positionsCalc])

  // ── Gains réalisés (réductions + clôtures) ──────────────────────────────────
  const gainVente = useMemo(() => positions.reduce((s, p) => {
    if (p.quantite < 0 && p.prixVente !== undefined) {
      const qty = Math.abs(p.quantite)
      return s + qty * (p.prixVente ?? 0) * (p.tauxVenteCHF ?? 1) - qty * p.prixAchat * p.tauxAchatCHF
    }
    if (p.dateVente && p.quantite > 0) {
      const pxV = p.prixVente ?? p.prixActuel
      const txV = p.tauxVenteCHF ?? p.tauxActuelCHF
      return s + p.quantite * pxV * txV - p.quantite * p.prixAchat * p.tauxAchatCHF
    }
    return s
  }, 0), [positions])

  // ── Modal ───────────────────────────────────────────────────────────────────
  // Auto-fetch historical price when sliceDate changes in reduction mode
  useEffect(() => {
    if (!sliceMode || !sliceDate || !form.ticker) {
      setSliceHistoPrice(null)
      return
    }
    setSliceHistoLoading(true)
    setSliceHistoPrice(null)
    fetchPriceCached(form.ticker, form.devise, sliceDate)
      .then(data => {
        setSliceHistoPrice(data)
        // Pre-fill the price field if user hasn't manually entered one
        if (data && slicePrixVenteRaw === '') {
          setSlicePrixVente(data.price)
        }
      })
      .finally(() => setSliceHistoLoading(false))
  }, [sliceDate, sliceMode, form.ticker, form.devise])

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setQuantiteRaw(''); setQuantiteError(null); setFetchModalError(null); setManuel(false); setSliceMode(false); setSliceDate(''); setSliceQuantiteRaw(''); setSliceQuantite(0); setSlicePrixVenteRaw(''); setSlicePrixVente(undefined); setSliceHistoPrice(null); setGroupHasSlices(false); setFormTickerMinDate(undefined); setShowModal(true) }
  function openEdit(p: Position) {
    // Calculer le total du groupe (tous lots actifs du même ticker)
    const grp = groupedPositions[p.ticker.toUpperCase()]
    const groupTotal = grp ? grp.reduce((s, pc) => s + pc.quantite, 0) : p.quantite
    const hasSlices = grp ? grp.length > 1 : false
    setEditId(p.id); setForm({ ...p }); setQuantiteRaw(String(p.quantite)); setQuantiteError(null); setFetchModalError(null); setManuel(true)
    setSliceMode(false); setSliceDate(p.dateAchat); setSliceQuantiteRaw(String(groupTotal)); setSliceQuantite(groupTotal)
    setSliceGroupTotal(groupTotal)
    setGroupHasSlices(hasSlices)
    setSlicePrixVenteRaw(''); setSlicePrixVente(undefined); setSliceHistoPrice(null)
    // Charger la première date dispo de l'historique du ticker (cache-first)
    setFormTickerMinDate(undefined)
    const cached = getMinDateFromCache(p.ticker)
    if (cached) {
      setFormTickerMinDate(cached)
    } else {
      fetchHistory(p.ticker).then(raw => {
        const hist = raw[p.ticker] as { dates?: string[] } | undefined
        if (hist?.dates && hist.dates.length > 0) setFormTickerMinDate(hist.dates[0])
      }).catch(() => {})
    }
    setShowModal(true)
  }

  async function upsertPositionDB(supabase: ReturnType<typeof createClient>, pos: Position) {
    const basePayload = {
      id: pos.id, user_id: userId,
      nom: pos.nom, ticker: pos.ticker, categorie: pos.categorie, devise: pos.devise,
      quantite: pos.quantite, prix_achat: pos.prixAchat, taux_achat_chf: pos.tauxAchatCHF,
      date_achat: pos.dateAchat, prix_actuel: pos.prixActuel, taux_actuel_chf: pos.tauxActuelCHF,
      courtier: pos.courtier ?? null, derniere_maj: pos.derniereMaj ?? null,
    }
    const payload = {
      ...basePayload,
      ...(pos.dateVente  !== undefined ? { date_vente: pos.dateVente }                                              : {}),
      ...(pos.prixVente  !== undefined ? { prix_vente: pos.prixVente, taux_vente_chf: pos.tauxVenteCHF ?? 1 }      : {}),
    }
    const { error } = await supabase.from('portfolio_positions').upsert(payload, { onConflict: 'id' })
    if (error) {
      if (error.message?.includes('date_vente') || error.message?.includes('prix_vente') || error.message?.includes('taux_vente_chf')) {
        // Colonne manquante — retenter sans colonnes optionnelles (migration requise)
        const { error: e2 } = await supabase.from('portfolio_positions').upsert(basePayload, { onConflict: 'id' })
        if (e2) console.error('[finveria] upsertPositionDB error:', e2.message)
        // migrations requises si absent : ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS date_vente date; ADD COLUMN IF NOT EXISTS prix_vente numeric; ADD COLUMN IF NOT EXISTS taux_vente_chf numeric;
      } else {
        console.error('[finveria] upsertPositionDB error:', error.message)
      }
    }
  }

  async function saveForm() {
    if (!form.ticker) return
    if (editId && sliceMode && sliceDate && form.dateAchat && sliceDate < form.dateAchat) return
    if (!sliceMode && !(editId && groupHasSlices) && (quantiteRaw === '' || !(form.quantite > 0))) {
      setQuantiteError('Veuillez saisir une quantité supérieure à 0')
      return
    }
    setQuantiteError(null)
    setShowModal(false)

    if (editId && sliceMode && sliceDate) {
      // MODE DELTA : ajouter une entrée de correction sans toucher à l'originale
      const newTotal = sliceQuantite || sliceGroupTotal
      const deltaQty = newTotal - sliceGroupTotal  // delta par rapport au total du groupe, pas du lot seul
      const isAddition = deltaQty > 0
      if (deltaQty !== 0) {
        const deltaPos: Position = {
          ...form,
          id: crypto.randomUUID(),
          quantite: deltaQty,
          dateAchat: sliceDate,
          dateVente: undefined,
          // Ajout de lot : nouveau prix d'achat propre au lot
          // Réduction : prix de vente + garder prixAchat original
          ...(isAddition ? {
            prixAchat: slicePrixVente ?? sliceHistoPrice?.price ?? form.prixActuel,
            tauxAchatCHF: sliceHistoPrice?.fxRate ?? form.tauxActuelCHF,
            prixVente: undefined,
            tauxVenteCHF: undefined,
          } : {
            prixVente: slicePrixVente ?? sliceHistoPrice?.price ?? form.prixActuel,
            tauxVenteCHF: sliceHistoPrice?.fxRate ?? form.tauxActuelCHF,
          }),
        }
        setPositions(ps => [...ps, deltaPos])
        if (userId) {
          const supabase = createClient()
          await upsertPositionDB(supabase, deltaPos)
        }
      }
      // L'ancienne position reste inchangée ; le total affiché = somme du groupe
    } else {
      // MODE NORMAL : remplacer ou créer
      const id = editId ?? crypto.randomUUID()
      const pos: Position = { ...form, id }
      if (editId) {
        setPositions(ps => ps.map(p => p.id === editId ? pos : p))
      } else {
        // Ajout d'un nouveau lot : mettre à jour le prix actuel de tous les lots ouverts
        // du même ticker pour garantir la cohérence dans l'onglet Analyse FX & Inflation
        const tickerUp = pos.ticker.toUpperCase()
        setPositions(ps => {
          const synced = ps.map(p =>
            p.ticker.toUpperCase() === tickerUp && !p.dateVente && p.quantite > 0
              ? { ...p, prixActuel: pos.prixActuel, tauxActuelCHF: pos.tauxActuelCHF, derniereMaj: pos.derniereMaj }
              : p
          )
          return [...synced, pos]
        })
      }

      if (userId) {
        const supabase = createClient()
        await upsertPositionDB(supabase, pos)
      }
    }
  }

  function openDeleteModal(p: Position) {
    setDeleteTarget(p)
    setDeleteMode('permanent')
    setDeleteCloseDate(new Date().toISOString().slice(0, 10))
    setShowDeleteModal(true)
  }

  // Auto-fetch historical price when close date changes
  useEffect(() => {
    if (deleteMode !== 'close' || !deleteCloseDate || !deleteTarget) {
      setDeleteHistoPrice(null)
      return
    }
    setDeleteHistoLoading(true)
    setDeleteHistoPrice(null)
    fetchPriceCached(deleteTarget.ticker, deleteTarget.devise, deleteCloseDate)
      .then(data => setDeleteHistoPrice(data))
      .finally(() => setDeleteHistoLoading(false))
  }, [deleteCloseDate, deleteMode, deleteTarget?.ticker, deleteTarget?.devise])

  async function confirmDelete() {
    if (!deleteTarget) return
    setShowDeleteModal(false)
    const id = deleteTarget.id

    if (deleteMode === 'permanent') {
      setPositions(ps => ps.filter(p => p.id !== id))
      if (userId) {
        const supabase = createClient()
        await supabase.from('portfolio_positions').delete().eq('id', id).eq('user_id', userId)
      }
    } else {
      // Clôturer = créer un lot de réduction pour la quantité nette FIFO restante du ticker
      // (même comportement qu'une réduction manuelle au maximum)
      const tickerUp = deleteTarget.ticker.toUpperCase()
      const tickerLots = positions.filter(p => p.ticker.toUpperCase() === tickerUp && !p.dateVente)
      const longsSort = tickerLots.filter(p => p.quantite > 0).sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))
      let alreadySold = tickerLots.filter(p => p.quantite < 0 && p.prixVente != null).reduce((s, p) => s + Math.abs(p.quantite), 0)
      let netFifoQty = 0
      for (const l of longsSort) {
        const consumed = Math.min(l.quantite, alreadySold)
        alreadySold = Math.max(0, alreadySold - consumed)
        netFifoQty += l.quantite - consumed
      }
      if (netFifoQty > 0) {
        const reductionLot: Position = {
          ...deleteTarget,
          id: crypto.randomUUID(),
          quantite: -netFifoQty,
          dateAchat: deleteCloseDate,
          dateVente: undefined,
          prixVente: deleteHistoPrice?.price ?? deleteTarget.prixActuel,
          tauxVenteCHF: deleteHistoPrice?.fxRate ?? deleteTarget.tauxActuelCHF,
        }
        setPositions(ps => [...ps, reductionLot])
        if (userId) {
          const supabase = createClient()
          await upsertPositionDB(supabase, reductionLot)
        }
      }
    }
    setDeleteTarget(null)
  }

  function exportCSV() {
    const headers = ['Nom','Ticker','Catégorie','Devise','Quantité','Prix achat','Taux achat CHF','Prix actuel','Taux actuel CHF','Date achat','Coût CHF','Valeur CHF','Gain CHF','Gain %','Gain réel CHF']
    const rows = positionsCalc.map(p => [
      p.nom, p.ticker, p.categorie, p.devise,
      p.quantite, p.prixAchat, p.tauxAchatCHF, p.prixActuel, p.tauxActuelCHF,
      p.dateAchat,
      p.coutCHF.toFixed(2), p.valeurCHF.toFixed(2), p.gainCHF.toFixed(2),
      p.gainPctCHF.toFixed(2), p.gainReel.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `finveria-portfolio-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }
  const fld = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))

  const clr = (n: number) => n >= 0 ? 'text-[#14B8A6]' : 'text-red-500'
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
  const chf = (n: number) => n.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
  const isEmpty = currentPositions.length === 0
  const lastMaj = currentPositions.map(p => p.derniereMaj).filter(Boolean).sort().pop()

  const inputCls = `w-full bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A]
    rounded-sm px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC]
    focus:outline-none focus:ring-2 focus:ring-[#14B8A6] focus:border-transparent placeholder-[#9E9A93]`

  // ── Drawdown max journalier — méthode VLU (Time-Weighted Return) ───────────
  const _positionsKey = positionsCalc.map(p => p.ticker + '|' + p.dateAchat + '|' + p.quantite).join(',')
  useEffect(() => {
    if (positionsCalc.length === 0) return
    setDailyMDDLoading(true)
    const longLotsPC = positionsCalc.filter(p => p.quantite > 0)
    const allDeltaPC = positionsCalc.filter(p => p.quantite < 0 && p.prixVente != null)
    const tickersPC = [...new Set(longLotsPC.map(p => p.ticker.toUpperCase()))]
    const fxPairsPC = [...new Set(longLotsPC.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
    fetchHistory([...tickersPC, ...fxPairsPC].join(','))
      .then((raw: Record<string, { dates: string[]; closes: number[] }>) => {
        // Build price map ticker → date → close (clé en majuscules)
        const priceMap: Record<string, Record<string, number>> = {}
        const dateSet = new Set<string>()
        for (const [ticker, hist] of Object.entries(raw)) {
          const tk = ticker.toUpperCase()
          priceMap[tk] = {}
          for (let i = 0; i < hist.dates.length; i++) {
            priceMap[tk][hist.dates[i]] = hist.closes[i]
            dateSet.add(hist.dates[i])
          }
        }
        const allDates = [...dateSet].sort()

        // Première date avec données réelles pour chaque ticker
        const tickerFirstDate: Record<string, string> = {}
        for (const [ticker, dayPrices] of Object.entries(priceMap)) {
          const sorted = Object.keys(dayPrices).filter(d => dayPrices[d] != null).sort()
          if (sorted.length > 0) tickerFirstDate[ticker] = sorted[0]
        }

        // ── Événements de flux de capital (VLU) ──────────────────────────────
        type CfEventD = { date: string; type: 'buy' | 'sell'; amount: number }
        const cfEvents: CfEventD[] = []
        for (const p of positionsCalc) {
          if (p.quantite > 0) {
            cfEvents.push({ date: p.dateAchat, type: 'buy', amount: p.coutCHF })
            if (p.dateVente) cfEvents.push({ date: p.dateVente, type: 'sell', amount: p.valeurCHF })
          } else if (p.quantite < 0 && p.prixVente != null) {
            cfEvents.push({ date: p.dateAchat, type: 'sell', amount: p.valeurCHF })
          }
        }
        cfEvents.sort((a, b) => a.date.localeCompare(b.date))
        let cfIdx = 0

        // ── État VLU ─────────────────────────────────────────────────────────
        const INITIAL_UNITS = 10000
        let totalUnits = 0, prevPortfolioV = 0, peakUnitV = -Infinity
        let peakDate = '', maxDD = 0, maxDDDate = '', maxDDPeakDate = ''

        // Forward-fill last known price par ticker
        const lastPrice: Record<string, number> = {}

        for (const date of allDates) {
          // Mise à jour des derniers prix connus
          for (const [ticker, dayPrices] of Object.entries(priceMap)) {
            if (dayPrices[date] != null) lastPrice[ticker] = dayPrices[date]
          }

          // Lots longs actifs à cette date
          const activeLong = longLotsPC.filter(p =>
            p.dateAchat <= date && (!p.dateVente || p.dateVente > date)
          )
          if (activeLong.length === 0) {
            while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= date) cfIdx++
            continue
          }

          // Exiger des données réelles pour tous les actifs actifs
          const allHaveData = activeLong.every(p => {
            const tk = p.ticker.toUpperCase()
            return tickerFirstDate[tk] != null && tickerFirstDate[tk] <= date
          })
          if (!allHaveData) continue

          // Consommer les flux de capital jusqu'à cette date
          let netCf = 0
          while (cfIdx < cfEvents.length && cfEvents[cfIdx].date <= date) {
            const cf = cfEvents[cfIdx++]
            netCf += cf.type === 'buy' ? cf.amount : -cf.amount
          }

          // Quantité nette par ticker (longs actifs − ventes partielles)
          const netQtyByTicker = new Map<string, number>()
          for (const p of activeLong) {
            const tk = p.ticker.toUpperCase()
            netQtyByTicker.set(tk, (netQtyByTicker.get(tk) ?? 0) + p.quantite)
          }
          for (const p of allDeltaPC) {
            if (p.dateAchat <= date) {
              const tk = p.ticker.toUpperCase()
              netQtyByTicker.set(tk, (netQtyByTicker.get(tk) ?? 0) + p.quantite) // négatif
            }
          }

          // Valeur de marché du portefeuille (prix forward-fill + FX historique forward-fill)
          let portfolioV = 0
          for (const [tk, netQty] of netQtyByTicker) {
            if (netQty <= 0) continue
            const px = lastPrice[tk]
            if (px == null) continue
            const lot = activeLong.find(p => p.ticker.toUpperCase() === tk)!
            const fxKey = lot.devise !== 'CHF' ? `${lot.devise}CHF=X` : null
            const fxRate = fxKey ? (lastPrice[fxKey] ?? lot.tauxActuelCHF) : 1
            portfolioV += netQty * px * fxRate
          }
          if (portfolioV <= 0) { prevPortfolioV = 0; continue }

          // Ajustement VLU : créer/détruire des parts au prix unitaire courant
          if (totalUnits === 0) {
            totalUnits = INITIAL_UNITS
          } else if (netCf !== 0) {
            const prevUnitV = prevPortfolioV > 0 ? prevPortfolioV / totalUnits : portfolioV / INITIAL_UNITS
            if (prevUnitV > 0) totalUnits += netCf / prevUnitV
            if (totalUnits <= 0) totalUnits = INITIAL_UNITS
          }
          prevPortfolioV = portfolioV

          const unitV = portfolioV / totalUnits
          if (unitV > peakUnitV) { peakUnitV = unitV; peakDate = date }

          if (peakUnitV > 0) {
            const dd = ((unitV - peakUnitV) / peakUnitV) * 100
            if (dd < maxDD) { maxDD = dd; maxDDDate = date; maxDDPeakDate = peakDate }
          }
        }

        setDailyMaxDrawdown(maxDD < -0.1 ? { pct: maxDD, peakDate: maxDDPeakDate, date: maxDDDate } : null)
        setDailyMDDLoading(false)
      })
      .catch(() => setDailyMDDLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_positionsKey])


  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#181C22] text-[#1B3050] dark:text-[#E8E4DC]">
      <Header />

      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 py-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Mon portfolio</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B5820F]/10 text-[#B5820F] border border-[#B5820F]/20">Premium</span>
          </div>
          <p className="text-[#5C6880] text-sm">Suivez vos positions en temps réel — performance, exposition aux devises, inflation et analyse de risque en un seul endroit.</p>
          {lastMaj && (
            <p className="text-xs text-[#9E9A93] mt-1">
              Dernière mise à jour : {new Date(lastMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {' '}· Données Twelve Data
            </p>
          )}

        </div>

        {refreshError && (
          <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-sm text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>⚠️ {refreshError}</span>
            <button onClick={() => setRefreshError(null)} className="ml-4 text-amber-400 hover:text-amber-600">×</button>
          </div>
        )}

        {isEmpty ? (
          <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-16 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-semibold mb-2">Commencez à suivre votre portefeuille</h2>
            <p className="text-[#5C6880] text-sm mb-6 max-w-sm mx-auto">
              Recherchez un actif par nom ou ticker — les prix et taux de change sont récupérés automatiquement.
            </p>
            <button onClick={openAdd} className="bg-[#14B8A6] hover:bg-[#225549] text-white text-sm font-medium px-5 py-2.5 rounded-sm transition-colors">
              + Ajouter ma première position
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* ── LEFT: Portfolio chart + Positions ── */}
              <div className="lg:col-span-2 flex flex-col gap-4">

                <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">

                  {/* ── Portfolio title row ── */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-0">
                    <h2 className="text-base font-bold text-[#1B3050] dark:text-white tracking-tight">Portfolio</h2>
                    <button onClick={openAdd}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1B3050] dark:bg-white/10 text-white text-xs font-semibold hover:bg-[#243f65] dark:hover:bg-white/20 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Ajouter une position
                    </button>
                  </div>
                  {/* ── Chart header: getquin-style tabs + time filters ── */}
                  <div className="flex items-center justify-between px-5 pt-3 pb-0">
                    {/* Chart type tabs (left) — styled like getquin account tabs */}
                    <div className="flex items-center">
                      {(['evol', 'pnl', 'drawdown'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setChartMode(m)}
                          className={`relative px-3 py-2 text-sm font-semibold transition-colors mr-1
                            ${chartMode === m
                              ? 'text-[#1B3050] dark:text-white'
                              : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'
                            }`}
                        >
                          {m === 'evol' ? 'Évolution' : m === 'pnl' ? 'PnL' : 'Drawdown'}
                          {chartMode === m && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B3050] dark:bg-white rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Time period filters (right) — like getquin 1J 1S 1M YTD 1A Max */}
                    <div className="flex items-center gap-0.5">
                      {(['1D', '1W', '1M', 'YTD', '1Y', 'Max'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => applyTimePeriod(p)}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-colors
                            ${timePeriod === p
                              ? 'bg-[#1B3050] dark:bg-white/10 text-white dark:text-white'
                              : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70 hover:bg-[#F5F3EF] dark:hover:bg-[#253040]'
                            }`}
                        >
                          {p === '1D' ? '1J' : p === '1W' ? '1S' : p === '1Y' ? '1A' : p}
                        </button>
                      ))}
                      <button onClick={() => { refreshPrices(); setChartBustKey(k => k + 1) }} disabled={refreshing} title="Rafraîchir les prix et données historiques"
                        className={`p-1.5 ml-1 rounded-sm hover:text-[#5C6880] hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors ${refreshing ? 'opacity-50 cursor-not-allowed text-[#5C6880]' : 'text-[#9E9A93]'}`} aria-label="Rafraîchir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-[#DDD9D1] dark:bg-[#253040] mx-5 mt-3 mb-0" />
                  <div className="pb-5 pt-4">

                  {chartMode === 'evol' && <EvolChart data={positionsCalc} showFX={true} range={chartRange} interval={chartInterval} dateFrom={chartDateFrom || undefined} dateTo={chartDateTo || undefined} bustKey={chartBustKey} downsampleEvery={chartDownsample} timePeriod={timePeriod} />}
                  {chartMode === 'pnl' && <PnLChart data={positionsCalc} range={chartRange} interval={chartInterval} dateFrom={chartDateFrom || undefined} dateTo={chartDateTo || undefined} bustKey={chartBustKey} downsampleEvery={chartDownsample} timePeriod={timePeriod} />}
                  {chartMode === 'drawdown' && <DrawdownChart data={positionsCalc} onMaxDrawdown={(pct, date) => setMaxDrawdown({ pct, date })} range={chartRange} interval={chartInterval} dateFrom={chartDateFrom || undefined} dateTo={chartDateTo || undefined} bustKey={chartBustKey} downsampleEvery={chartDownsample} timePeriod={timePeriod} />}
                  </div>{/* end px-5 pt-4 pb-5 wrapper */}

                </div>

                <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                  {/* ── Positions title row ── */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-0">
                    <h2 className="text-base font-bold text-[#1B3050] dark:text-white tracking-tight">Positions ouvertes</h2>
                  </div>
                  {/* ── Positions tabs — same style as Portfolio chart tabs ── */}
                  <div className="flex items-center px-5 pt-3 pb-0 overflow-x-auto">
                  {(['positions', 'analyse', 'cloturees'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`relative px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors mr-1
                        ${activeTab === tab
                          ? 'text-[#1B3050] dark:text-white'
                          : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'}`}>
                      {tab === 'positions' ? 'Positions ouvertes' : tab === 'analyse' ? 'Analyse FX & Inflation' : 'Positions clôturées'}
                      {activeTab === tab && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B3050] dark:bg-white rounded-full" />
                      )}
                    </button>
                  ))}
                  </div>
                  <div className="h-px bg-[#DDD9D1] dark:bg-[#253040] mx-5 mt-3 mb-0" />

            {activeTab === 'positions' && (
              <div className="">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Actif', 'Quantité', 'Prix actuel', 'Valeur CHF', 'Gain CHF', 'Perf.', 'MAJ', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupOrder.map(ticker => {
                        const group = groupedPositions[ticker]
                        const longLots = group.filter(p => p.quantite > 0)
                        const isMulti = longLots.length > 1
                        const isExpanded = expandedTickers.has(ticker)
                        const first = group[0]
                        // Quantité nette restante (ex: 1000 − 200 = 800)
                        const gQteNet = group.reduce((s, p) => s + p.quantite, 0)
                        // Valeur au prix actuel sur la quantité restante uniquement
                        const gVal  = gQteNet * first.prixActuel * first.tauxActuelCHF
                        // Coût net = coût longs − coût des ventes (pour éviter le double-comptage)
                        const gCout = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
                        // Gain = (valeur restante − coût net) + gains réalisés des ventes
                        const gRealizedGains = group.filter(p => p.quantite < 0 && p.prixVente != null).reduce((s, p) => s + p.gainCHF, 0)
                        const gGain = gVal - gCout
                        const gPerf = gCout > 0 ? (gGain / gCout) * 100 : 0
                        const gQte  = gQteNet
                        const gMaj  = group.reduce((m, p) => p.derniereMaj && (!m || p.derniereMaj > m) ? p.derniereMaj : m, '')
                        const toggle = () => setExpandedTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                        return (
                          <React.Fragment key={ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#253040]/50 transition-colors ${isExpanded ? 'bg-[#F5F3EF]/30 dark:bg-[#1E2530]/30' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {isMulti && (
                                    <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                      {isExpanded ? '▾' : '▸'}
                                    </button>
                                  )}
                                  <div>
                                    <div className="font-medium">{first.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">{first.ticker} · {first.categorie}{isMulti ? ` · ${longLots.length} lots` : ''}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{gQte}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                <div>{first.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {first.devise}</div>
                                {first.devise !== 'CHF' && <div className="text-[#9E9A93]">×{first.tauxActuelCHF.toFixed(4)}</div>}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <div>{chf(gVal)}</div>
                                <div className="text-xs text-[#9E9A93]">Coût: {chf(gCout)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gGain)}`}>{gGain >= 0 ? '+' : ''}{chf(gGain)}</td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(gPerf)}`}>
                                <div>{pct(gPerf)}</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#9E9A93]">
                                {gMaj ? new Date(gMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => openEdit(first)} className="text-xs text-[#9E9A93] hover:underline">Modifier</button>
                                  <button onClick={() => openDeleteModal(first)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                </div>
                              </td>
                            </tr>
                            {isMulti && isExpanded && (() => {
                              const _fifo: Map<string, number> = new Map()
                              const _longs = [...group].filter(q => q.quantite > 0).sort((a,b) => new Date(a.dateAchat).getTime()-new Date(b.dateAchat).getTime())
                              let _sold = group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s,q)=>s+Math.abs(q.quantite),0)
                              for (const _l of _longs){const _r=Math.min(_l.quantite,_sold);_fifo.set(_l.id,_l.quantite-_r);_sold=Math.max(0,_sold-_r)}
                              return group.filter(p => p.quantite > 0 && (_fifo.get(p.id) ?? p.quantite) > 0).map(p => {
                                const _dQty    = p.quantite > 0 ? (_fifo.get(p.id) ?? p.quantite) : p.quantite
                                const _dVal    = p.quantite > 0 ? _dQty * p.prixActuel * p.tauxActuelCHF : p.valeurCHF
                                const _dCout   = p.quantite > 0 ? _dQty * p.prixAchat * p.tauxAchatCHF : p.coutCHF
                                const _dGain   = _dVal - _dCout
                                const _dGainPct = _dCout > 0 ? (_dGain / _dCout) * 100 : 0
                                return (
                              <tr key={p.id} className="bg-[#F5F3EF]/60 dark:bg-[#1E2530]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                <td className="px-4 py-2 pl-9">
                                  <div className="text-xs font-medium flex items-center gap-1.5">
                                    {p.quantite < 0 ? '⇘ Vente du' : 'Lot du'} {fmtDate(p.dateAchat)}
                                  </div>
                                  <div className="text-xs text-[#9E9A93]">
                                    {p.quantite < 0
                                      ? p.prixVente
                                        ? <>Achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} → vente : {p.prixVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                        : <>Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                      : <>Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                    }
                                  </div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${p.quantite < 0 ? 'text-red-400' : ''}`}>{_dQty}</td>
                                <td className="px-4 py-2 text-xs text-[#9E9A93]">—</td>
                                <td className="px-4 py-2 font-mono text-xs">
                                  <div>
                                    <div>{chf(_dVal)}</div>
                                    <div className="text-[#9E9A93] text-[10px]">coût : {chf(_dCout)}</div>
                                  </div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(_dGain)}`}>
                                  {(_dGain >= 0 ? '+' : '') + chf(_dGain)}
                                  {p.quantite < 0 && <div className="text-[#9E9A93] text-[10px]">réalisé</div>}
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(_dGainPct)}`}>
                                  {pct(_dGainPct)}
                                </td>
                                <td className="px-4 py-2 text-xs text-[#9E9A93]">—</td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => openDeleteModal(p)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                  </div>
                                </td>
                              </tr>
                                )
                              })
                            })()
                            }
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'analyse' && (
              <div className="">
                <div className="px-5 py-3 border-b border-[#F5F3EF] dark:border-[#2A3240] flex gap-6 text-xs text-[#9E9A93]">
                  <span><strong className="text-[#1B3050] dark:text-[#E8E4DC]">CHF nominal</strong> — gain total en CHF</span>
                  <span><strong className="text-[#14B8A6]">FX uniquement</strong> — part due au change</span>
                  <span><strong className="text-[#B5820F]">Réel</strong> — après inflation suisse (IPC OFS)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Actif', 'Perf. devise', 'Perf. CHF', 'Impact FX', 'Perf. réelle'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupOrder.map(ticker => {
                        const group = groupedPositions[ticker]
                        const isMulti = group.length > 1
                        const isExpanded = expandedTickers.has(ticker)
                        const first = group[0]
                        const toggle = () => setExpandedTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                        // Métriques basées sur positions ouvertes uniquement (FIFO net)
                        const longsA      = group.filter(p => p.quantite > 0)
                        // FIFO : calculer les quantités résiduelles par lot
                        const _fifoA: Map<string, number> = new Map()
                        const _longsSort = [...longsA].sort((a,b) => new Date(a.dateAchat).getTime()-new Date(b.dateAchat).getTime())
                        let _soldA = group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s,q)=>s+Math.abs(q.quantite),0)
                        for (const _l of _longsSort){const _r=Math.min(_l.quantite,_soldA);_fifoA.set(_l.id,_l.quantite-_r);_soldA=Math.max(0,_soldA-_r)}
                        const longsAActive = longsA.filter(p => (_fifoA.get(p.id) ?? p.quantite) > 0)
                        // Référence de prix = lot le plus récemment rafraîchi (même actif = même prix courant)
                        const priceRef    = longsA.reduce(
                          (best, p) => ((p.derniereMaj ?? '') >= (best.derniereMaj ?? '') ? p : best),
                          longsA[0] ?? first
                        )
                        // Quantité nette restante et valeur au prix actuel
                        const gQteNetA    = group.reduce((s, p) => s + p.quantite, 0)
                        const gVal        = gQteNetA * priceRef.prixActuel * priceRef.tauxActuelCHF
                        // Coût net en CHF (longs − réductions)
                        const gCout       = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
                        const gGainCHF    = gVal - gCout
                        // Gain en devise et FX sur la position nette ouverte uniquement
                        // Coût en devise basé sur les quantités FIFO restantes (évite le double-comptage des lots de réduction)
                        const gCoutDevise = longsAActive.reduce((s, p) => s + (_fifoA.get(p.id) ?? p.quantite) * p.prixAchat, 0)
                        const gGainDevise = gQteNetA * priceRef.prixActuel - gCoutDevise
                        // Impact FX : somme des impacts par lot (chacun avec son propre taux d'achat)
                        // → cohérent avec les sous-lignes, évite l'erreur du taux moyen pondéré par prix
                        const gImpactFX   = first.devise === 'CHF' ? 0 : longsAActive.reduce((s, p) => {
                          const qFifo = _fifoA.get(p.id) ?? p.quantite
                          return s + p.impactFX * (qFifo / p.quantite)
                        }, 0)
                        // Gain réel = gain CHF − inflation par lot depuis sa propre date d'achat
                        // → cohérent avec les sous-lignes, évite d'appliquer l'inflation 2015 au lot 2023
                        const gGainReel   = gGainCHF - longsAActive.reduce((s, p) => {
                          const qFifo = _fifoA.get(p.id) ?? p.quantite
                          const scale = p.quantite > 0 ? qFifo / p.quantite : 1
                          return s + p.coutCHF * scale * inflationCumulee(p.dateAchat)
                        }, 0)
                        const gPerfCHF    = gCout > 0 ? (gGainCHF / gCout) * 100 : 0
                        const gPerfDevise = gCoutDevise > 0 ? (gGainDevise / gCoutDevise) * 100 : 0
                        const gPerfReel   = gCout > 0 ? (gGainReel / gCout) * 100 : 0
                        return (
                          <React.Fragment key={ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#253040]/50 transition-colors ${isExpanded ? 'bg-[#F5F3EF]/30 dark:bg-[#1E2530]/30' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {longsAActive.length > 1 && (
                                    <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                      {isExpanded ? '▾' : '▸'}
                                    </button>
                                  )}
                                  <div>
                                    <div className="font-medium">{first.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">{first.ticker}{longsAActive.length > 1 ? ` · ${longsAActive.length} lots` : ` · ${fmtDate(first.dateAchat)}`}</div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gPerfDevise)}`}>
                                <div>{pct(gPerfDevise)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainDevise >= 0 ? '+' : ''}{gGainDevise.toFixed(2)} {first.devise}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gPerfCHF)}`}>
                                <div>{pct(gPerfCHF)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainCHF >= 0 ? '+' : ''}{chf(gGainCHF)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gImpactFX)}`}>
                                {first.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{gImpactFX >= 0 ? '+' : ''}{chf(gImpactFX)}</>}
                              </td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(gPerfReel)}`}>
                                <div>{pct(gPerfReel)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainReel >= 0 ? '+' : ''}{chf(gGainReel)}</div>
                              </td>
                            </tr>
                            {longsAActive.length > 1 && isExpanded && longsAActive.map(p => {
                              // Quantité FIFO résiduelle pour ce lot (peut être < p.quantite si une partie a été vendue)
                              const qFifo = _fifoA.get(p.id) ?? p.quantite
                              // Ratio pour mettre à l'échelle les montants absolus (les % restent identiques)
                              const scale = p.quantite > 0 ? qFifo / p.quantite : 1
                              const pGainDevise = p.gainDevise * scale
                              const pGainCHF    = p.gainCHF    * scale
                              const pImpactFX   = p.impactFX   * scale
                              const pGainReel   = p.gainReel   * scale
                              const pValCHF     = p.valeurCHF  * scale
                              return (
                                <tr key={p.id} className="bg-[#F5F3EF]/60 dark:bg-[#1E2530]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                  <td className="px-4 py-2 pl-9">
                                    <div className="text-xs font-medium">Lot du {fmtDate(p.dateAchat)}</div>
                                    <div className="text-xs text-[#9E9A93]">Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctDevise)}`}>
                                    <div>{pct(p.gainPctDevise)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainDevise >= 0 ? '+' : ''}{pGainDevise.toFixed(2)} {p.devise}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctCHF)}`}>
                                    <div>{pct(p.gainPctCHF)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainCHF >= 0 ? '+' : ''}{chf(pGainCHF)}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(pImpactFX)}`}>
                                    {p.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{pImpactFX >= 0 ? '+' : ''}{chf(pImpactFX)}</>}
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(p.gainPctReel)}`}>
                                    <div>{pct(p.gainPctReel)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainReel >= 0 ? '+' : ''}{chf(pGainReel)}</div>
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'cloturees' && (
              <div className="">
                <div className="px-5 py-3 border-b border-[#F5F3EF] dark:border-[#2A3240]">
                  <p className="text-xs text-[#9E9A93]">
                    Gains et pertes <strong className="text-[#1B3050] dark:text-[#E8E4DC]">réalisés</strong> lors des réductions ou clôtures de positions — calculés au prix effectif de vente.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Actif', 'Date opération', 'Qté vendue', 'Px achat', 'Taux achat', 'Px vente', 'Taux vente', 'Gain CHF', 'Perf.', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // ── FIFO split display for cloturées ──────────────────────────────
                        // Build mutable remaining-qty map for long lots, per ticker
                        type LongWithRem = (typeof positions)[0] & { _remaining: number }
                        const longsByTicker = new Map<string, LongWithRem[]>()
                        positions
                          .filter(p => p.quantite > 0 && !p.dateVente)
                          .sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))
                          .forEach(p => {
                            if (!longsByTicker.has(p.ticker)) longsByTicker.set(p.ticker, [])
                            longsByTicker.get(p.ticker)!.push({ ...p, _remaining: p.quantite })
                          })

                        type SplitRow = {
                          key: string
                          sale: (typeof positions)[0]
                          longLot: LongWithRem | null
                          splitQty: number
                          dateDebut: string | null
                          dateOp: string
                        }
                        const splitRows: SplitRow[] = []

                        // Process delta (sale) lots in chronological order → FIFO split
                        const sortedSales = positions
                          .filter(p => p.quantite < 0 && p.prixVente !== undefined)
                          .sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))

                        for (const sale of sortedSales) {
                          let rem = Math.abs(sale.quantite)
                          const longs = longsByTicker.get(sale.ticker) ?? []
                          for (const ll of longs) {
                            if (rem <= 0) break
                            if (ll._remaining <= 0) continue
                            const consumed = Math.min(ll._remaining, rem)
                            splitRows.push({ key: `${sale.id}-${ll.id}`, sale, longLot: ll, splitQty: consumed, dateDebut: ll.dateAchat, dateOp: sale.dateAchat })
                            ll._remaining -= consumed
                            rem -= consumed
                          }
                          if (rem > 0) {
                            // orphan: no long lot found (data inconsistency)
                            splitRows.push({ key: `${sale.id}-orphan`, sale, longLot: null, splitQty: rem, dateDebut: null, dateOp: sale.dateAchat })
                          }
                        }

                        // Classic closed rows (dateVente + quantite > 0)
                        const closedRows = positions
                          .filter(p => p.dateVente && p.quantite > 0)
                          .sort((a, b) => (b.dateVente ?? '').localeCompare(a.dateVente ?? ''))

                        // Check if anything to show
                        if (splitRows.length === 0 && closedRows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#9E9A93]">
                                Aucune position clôturée ou réduite pour l&apos;instant.
                              </td>
                            </tr>
                          )
                        }

                        // Render FIFO split rows (delta sales)
                        const splitElements = splitRows
                          .sort((a, b) => b.dateOp.localeCompare(a.dateOp))
                          .map(({ key, sale, longLot, splitQty, dateDebut, dateOp }) => {
                            const pxAchat = longLot?.prixAchat ?? sale.prixAchat
                            const txAchat = longLot?.tauxAchatCHF ?? sale.tauxAchatCHF
                            const pxVente = sale.prixVente ?? 0
                            const txVente = sale.tauxVenteCHF ?? 1
                            const coutCHF = splitQty * pxAchat * txAchat
                            const venteCHF = splitQty * pxVente * txVente
                            const gainCHF = venteCHF - coutCHF
                            const gainPct = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
                            return (
                              <tr key={key} className="hover:bg-[#F9F8F5] dark:hover:bg-[#2A3240]/40 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-[#1B3050] dark:text-[#E8E4DC] text-sm">{sale.ticker}</div>
                                  <div className="text-xs text-[#9E9A93]">{sale.nom}</div>
                                  <div className="text-xs text-[#9E9A93] mt-0.5">⇘ Réduction</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  <div>{fmtDate(dateOp)}</div>
                                  {dateDebut && <div className="text-[#9E9A93] text-[10px] mt-0.5">depuis {fmtDate(dateDebut)}</div>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{splitQty.toLocaleString('fr-CH', { maximumFractionDigits: 4 })}</td>
                                <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                  <div>{pxAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {sale.devise}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                  {sale.devise === 'CHF'
                                    ? <span className="text-[#9E9A93]">—</span>
                                    : <div>
                                        <div>{txAchat.toFixed(4)}</div>
                                        <div className="text-[#9E9A93] text-[10px]">{sale.devise}/CHF</div>
                                      </div>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  {pxVente > 0
                                    ? <div>{pxVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {sale.devise}</div>
                                    : <span className="text-[#9E9A93]">—</span>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  {sale.devise === 'CHF'
                                    ? <span className="text-[#9E9A93]">—</span>
                                    : txVente > 0
                                      ? <div>
                                          <div>{txVente.toFixed(4)}</div>
                                          <div className="text-[#9E9A93] text-[10px]">{sale.devise}/CHF</div>
                                        </div>
                                      : <span className="text-[#9E9A93]">—</span>}
                                </td>
                                <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainCHF >= 0 ? 'text-[#14B8A6]' : 'text-red-500'}`}>
                                  {(gainCHF >= 0 ? '+' : '') + chf(gainCHF)}
                                </td>
                                <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainPct >= 0 ? 'text-[#14B8A6]' : 'text-red-500'}`}>
                                  {pct(gainPct)}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={async () => {
                                      setPositions(ps => ps.filter(x => x.id !== sale.id))
                                      if (userId) {
                                        const supabase = createClient()
                                        await supabase.from('portfolio_positions').delete().eq('id', sale.id).eq('user_id', userId)
                                      }
                                    }}
                                    className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
                                  >
                                    Annuler
                                  </button>
                                </td>
                              </tr>
                            )
                          })

                        // Render classic closed rows (quantite > 0, dateVente set)
                        const closedElements = closedRows.map(p => {
                          const pxVente = p.prixVente ?? p.prixActuel
                          const txVente = p.tauxVenteCHF ?? p.tauxActuelCHF
                          const coutCHF = p.quantite * p.prixAchat * p.tauxAchatCHF
                          const venteCHF = p.quantite * pxVente * txVente
                          const gainCHF = venteCHF - coutCHF
                          const gainPct = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
                          return (
                            <tr key={p.id} className="hover:bg-[#F9F8F5] dark:hover:bg-[#2A3240]/40 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#1B3050] dark:text-[#E8E4DC] text-sm">{p.ticker}</div>
                                <div className="text-xs text-[#9E9A93]">{p.nom}</div>
                                <div className="text-xs text-[#9E9A93] mt-0.5">✓ Clôture</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                <div>{fmtDate(p.dateVente ?? '—')}</div>
                                <div className="text-[#9E9A93] text-[10px] mt-0.5">depuis {fmtDate(p.dateAchat)}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{p.quantite.toLocaleString('fr-CH', { maximumFractionDigits: 4 })}</td>
                              <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                <div>{p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                {p.devise === 'CHF'
                                  ? <span className="text-[#9E9A93]">—</span>
                                  : <div>
                                      <div>{p.tauxAchatCHF.toFixed(4)}</div>
                                      <div className="text-[#9E9A93] text-[10px]">{p.devise}/CHF</div>
                                    </div>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                {pxVente > 0
                                  ? <div>{pxVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                                  : <span className="text-[#9E9A93]">—</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                {p.devise === 'CHF'
                                  ? <span className="text-[#9E9A93]">—</span>
                                  : txVente > 0
                                    ? <div>
                                        <div>{txVente.toFixed(4)}</div>
                                        <div className="text-[#9E9A93] text-[10px]">{p.devise}/CHF</div>
                                      </div>
                                    : <span className="text-[#9E9A93]">—</span>}
                              </td>
                              <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainCHF >= 0 ? 'text-[#14B8A6]' : 'text-red-500'}`}>
                                {(gainCHF >= 0 ? '+' : '') + chf(gainCHF)}
                              </td>
                              <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainPct >= 0 ? 'text-[#14B8A6]' : 'text-red-500'}`}>
                                {pct(gainPct)}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={async () => {
                                    setPositions(ps => ps.filter(x => x.id !== p.id))
                                    if (userId) {
                                      const supabase = createClient()
                                      await supabase.from('portfolio_positions').delete().eq('id', p.id).eq('user_id', userId)
                                    }
                                  }}
                                  className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
                                >
                                  Annuler
                                </button>
                              </td>
                            </tr>
                          )
                        })

                        return [...splitElements, ...closedElements]
                      })()}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const deltaRows = positions.filter(p => p.quantite < 0 && p.prixVente !== undefined)
                        const closedRows = positions.filter(p => p.dateVente && p.quantite > 0)
                        const allRows = [...deltaRows, ...closedRows]
                        if (allRows.length === 0) return null

                        // ── Gain total ────────────────────────────────────────────────────
                        const totalGain = allRows.reduce((s, p) => {
                          const isDelta = p.quantite < 0
                          const qteVendue = Math.abs(p.quantite)
                          const pxVente = isDelta ? (p.prixVente ?? 0) : (p.prixVente ?? p.prixActuel)
                          const txVente = isDelta ? (p.tauxVenteCHF ?? 1) : (p.tauxVenteCHF ?? p.tauxActuelCHF)
                          const coutCHF = qteVendue * p.prixAchat * p.tauxAchatCHF
                          const venteCHF = qteVendue * pxVente * txVente
                          return s + (venteCHF - coutCHF)
                        }, 0)
                        return (
                          <tr className="border-t-2 border-[#DDD9D1] dark:border-[#323B4A] bg-[#F9F8F5] dark:bg-[#1E2530]">
                            <td colSpan={7} className="px-4 py-3 text-xs font-semibold text-[#5C6880] uppercase tracking-wider">
                              Total réalisé
                            </td>
                            <td className={`px-4 py-3 font-mono text-sm font-bold ${totalGain >= 0 ? 'text-[#14B8A6]' : 'text-red-500'}`}>
                              {(totalGain >= 0 ? '+' : '') + chf(totalGain)}
                            </td>
                            <td colSpan={2} className="px-4 py-3" />
                          </tr>
                        )
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
                </div>

              </div>

              {/* ── RIGHT: Profil + Allocation ── */}
              <div className="lg:col-span-1 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

                {/* ── Analyse du portefeuille card ── */}
                <Link href="/portfolio/analyse" className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] p-4 flex items-center justify-between hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors group">
                  <div>
                    <h2 className="text-base font-bold text-[#1B3050] dark:text-white">Analyse du portefeuille</h2>
                    <p className="text-xs text-[#9E9A93] mt-0.5">Monte Carlo · stress tests · frontière efficiente</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#9E9A93] group-hover:text-[#1B3050] dark:group-hover:text-white transition-colors flex-shrink-0"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>

                <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                  {/* ── Allocation title row ── */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-0">
                    <h2 className="text-base font-bold text-[#1B3050] dark:text-white tracking-tight">Allocation</h2>
                  </div>
                  {/* ── Allocation sub-tabs ── */}
                  <div className="flex items-center px-5 pt-3 pb-0">
                    {(['categorie', 'positions'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setAllocTab(t)}
                        className={`relative px-3 py-2 text-sm font-semibold transition-colors mr-1
                          ${allocTab === t
                            ? 'text-[#1B3050] dark:text-white'
                            : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-white/70'
                          }`}
                      >
                        {t === 'positions' ? 'Actifs' : 'Catégorie'}
                        {allocTab === t && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B3050] dark:bg-white rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-[#DDD9D1] dark:bg-[#253040] mx-5 mt-3 mb-0" />
                  <div className="p-5">
                    {allocTab === 'categorie' ? <AllocChart data={positionsCalc} /> : <PositionsAllocChart data={positionsCalc} />}
                  </div>
                </div>

                {/* ── PnL par période ── */}
                <PnLBarChart positions={allPositionsCalc} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modale de suppression */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#2A3240]">
              <h2 className="font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Supprimer la position</h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#5C6880] dark:text-[#A8B8C8]">
                <span className="font-medium text-[#1B3050] dark:text-[#E8E4DC]">{deleteTarget.nom || deleteTarget.ticker}</span>
                {' '}— comment souhaitez-vous supprimer cette position ?
              </p>

              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${deleteMode === 'permanent' ? 'border-[#14B8A6] bg-[#14B8A6]/5' : 'border-[#DDD9D1] dark:border-[#323B4A] hover:border-[#14B8A6]/50'}`}>
                  <input type="radio" name="deleteMode" value="permanent" checked={deleteMode === 'permanent'}
                    onChange={() => setDeleteMode('permanent')} className="mt-0.5 accent-[#14B8A6]" />
                  <div>
                    <p className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC]">Supprimer définitivement</p>
                    <p className="text-xs text-[#9E9A93] mt-0.5">La position est supprimée de toutes les données.</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${deleteMode === 'close' ? 'border-[#14B8A6] bg-[#14B8A6]/5' : 'border-[#DDD9D1] dark:border-[#323B4A] hover:border-[#14B8A6]/50'}`}>
                  <input type="radio" name="deleteMode" value="close" checked={deleteMode === 'close'}
                    onChange={() => setDeleteMode('close')} className="mt-0.5 accent-[#14B8A6]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC]">Clôturer à une date</p>
                    <p className="text-xs text-[#9E9A93] mt-0.5">La position reste dans l'historique mais disparaît du portefeuille actuel à partir de la date choisie.</p>
                    {deleteMode === 'close' && (
                      <div className="mt-2 space-y-2">
                        <FormDatePicker
                          value={deleteCloseDate}
                          min={deleteTarget?.dateAchat}
                          onChange={v => { setDeleteCloseDate(v); setDeleteHistoPrice(null) }}
                        />
                        {deleteCloseDate && deleteHistoLoading && (
                          <p className="text-xs text-[#9E9A93] animate-pulse">Récupération du prix historique…</p>
                        )}
                        {deleteCloseDate && !deleteHistoLoading && deleteHistoPrice && (
                          <p className="text-xs text-[#14B8A6]">
                            Prix au {deleteCloseDate} : <strong>{deleteHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {deleteTarget?.devise}</strong>
                            {deleteTarget?.devise !== 'CHF' && <> · Taux CHF : <strong>{deleteHistoPrice.fxRate.toFixed(4)}</strong></>}
                          </p>
                        )}
                        {deleteCloseDate && !deleteHistoLoading && !deleteHistoPrice && (
                          <p className="text-xs text-[#9E9A93]">Prix historique non disponible — prix actuel utilisé.</p>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#323B4A] text-[#5C6880] text-sm py-2 rounded-sm hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors">
                  Annuler
                </button>
                <button onClick={confirmDelete}
                  disabled={deleteMode === 'close' && !deleteCloseDate}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-2 rounded-sm transition-colors font-medium">
                  {deleteMode === 'permanent' ? 'Supprimer' : 'Clôturer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#2A3240]">
              <h2 className="font-semibold">{editId ? 'Modifier la position' : 'Ajouter une position'}</h2>
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button type="button" className="w-5 h-5 rounded-full border border-[#9E9A93] text-[#9E9A93] hover:border-[#1B3050] hover:text-[#1B3050] dark:hover:border-[#A8D8C8] dark:hover:text-[#A8D8C8] text-xs flex items-center justify-center transition-colors leading-none">?</button>
                  <div className="absolute right-0 top-7 w-72 bg-white dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm shadow-lg p-3 text-xs text-[#5C6880] dark:text-[#A8B8C8] hidden group-hover:block z-10">
                    <p className="font-medium text-[#1B3050] dark:text-[#E8E4DC] mb-1">Catégorisation automatique</p>
                    <p>La catégorie est attribuée automatiquement selon le type retourné par Twelve Data, mais des erreurs peuvent survenir — notamment pour les ETF obligataires ou certains fonds.</p>
                    <p className="mt-1.5">Vous pouvez toujours <span className="font-medium text-[#1B3050] dark:text-[#E8E4DC]">modifier la catégorie manuellement</span> en cliquant sur les boutons ci-dessus.</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
              </div>
            </div>
            <div className="p-6 space-y-5">

              {/* 1. Catégorie */}
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Catégorie</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(f => ({ ...f, categorie: c }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.categorie === c
                          ? 'bg-[#14B8A6] text-white border-[#14B8A6]'
                          : 'border-[#DDD9D1] dark:border-[#323B4A] text-[#5C6880] hover:border-[#14B8A6] hover:text-[#14B8A6]'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Recherche actif */}
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                  Actif *
                  {editId && groupHasSlices && <span className="ml-1 text-[#9E9A93] font-normal">(verrouillé)</span>}
                </label>
                {editId && groupHasSlices ? (
                  <div className={`${inputCls} bg-[#F5F3EF] dark:bg-[#181C22] text-[#9E9A93] cursor-not-allowed select-none`}
                    title="L'actif ne peut plus être modifié après un ajout ou une réduction">
                    {form.nom ? `${form.nom} · ` : ''}<span className="font-mono text-[#14B8A6] font-medium">{form.ticker}</span>
                    {form.devise ? <span className="font-mono text-[#9E9A93]"> · {form.devise}</span> : null}
                  </div>
                ) : (
                  <>
                    <TickerAutocomplete
                      placeholder={CATEGORY_PLACEHOLDER[form.categorie]}
                      value={{ ticker: form.ticker, nom: form.nom, devise: form.devise }}
                      filterTypes={effectiveTypes}
                      filterExch={brokerProfile?.exchKeywords}
                      categorySuggestions={CATEGORY_SUGGESTIONS[form.categorie]}
                      onChange={({ ticker, nom, devise, type }) => {
                        const TYPE_TO_CAT: Record<string, string> = {
                          'equity': 'Actions', 'etf': 'ETF',
                          'action': 'Actions',
                          'cryptocurrency': 'Crypto', 'crypto': 'Crypto',
                          'future': 'Matières premières', 'futures': 'Matières premières', 'commodity': 'Matières premières',
                          'currency': 'Forex', 'forex': 'Forex',
                          'mutual fund': 'Fonds', 'mutualfund': 'Fonds', 'bond': 'Fonds', 'fonds': 'Fonds',
                          'etc': 'ETF', 'etn': 'ETF',
                        }
                        const categorie = TYPE_TO_CAT[type.toLowerCase()] ?? form.categorie
                        setForm(f => ({ ...f, ticker, nom, devise, categorie }))
                        setFetchModalError(null)
                        setFormTickerMinDate(undefined)
                        if (ticker) {
                          setManuel(true)
                          fetchPrixActuelFor(ticker, devise)
                          if (form.dateAchat) fetchPrixAchatFor(ticker, devise, form.dateAchat)
                          const cachedMin = getMinDateFromCache(ticker)
                          if (cachedMin) {
                            setFormTickerMinDate(cachedMin)
                          } else {
                            fetchHistory(ticker).then(raw => {
                              const hist = raw[ticker] as { dates?: string[] } | undefined
                              if (hist?.dates && hist.dates.length > 0) setFormTickerMinDate(hist.dates[0])
                            }).catch(() => {})
                          }
                        }
                      }}
                    />
                    {form.ticker && (
                      <p className="text-xs text-[#9E9A93] mt-1">
                        <span className="font-mono text-[#14B8A6] font-medium">{form.ticker}</span>
                        {' '}· <span className="font-mono">{form.devise}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 3. Quantité + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">
                    Quantité
                    {editId && groupHasSlices && <span className="ml-1 text-[#9E9A93] font-normal">(verrouillé)</span>}
                  </label>
                  {editId && groupHasSlices ? (
                    <div className={`${inputCls} bg-[#F5F3EF] dark:bg-[#181C22] text-[#9E9A93] cursor-not-allowed select-none`}
                      title="Modifiez via Ajout/Réduction pour changer la quantité">
                      {sliceGroupTotal}
                    </div>
                  ) : (
                    <>
                      <input className={`${inputCls}${quantiteError ? ' border-red-400 dark:border-red-500 ring-1 ring-red-400' : ''}`} type="text" inputMode="decimal"
                        placeholder="ex: 0.00001" value={quantiteRaw}
                        onChange={e => {
                          const raw = e.target.value
                          if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                            setQuantiteRaw(raw)
                            const num = parseFloat(raw.replace(',', '.'))
                            if (!isNaN(num)) { setForm(f => ({ ...f, quantite: num })); if (num > 0) setQuantiteError(null) }
                            else if (raw === '') setForm(f => ({ ...f, quantite: 0 }))
                          }
                        }} />
                      {quantiteError && <p className="text-xs text-red-500 mt-1">{quantiteError}</p>}
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">
                    Date d'achat
                    {editId && groupHasSlices && <span className="ml-1 text-[#9E9A93] font-normal">(verrouillé)</span>}
                  </label>
                  {editId && groupHasSlices ? (
                    <div className={`${inputCls} bg-[#F5F3EF] dark:bg-[#181C22] text-[#9E9A93] cursor-not-allowed select-none`}
                      title="La date d'achat ne peut plus être modifiée après un ajout ou une réduction">
                      {form.dateAchat ? fmtDate(form.dateAchat) : ''}
                    </div>
                  ) : (
                    <FormDatePicker
                      value={form.dateAchat}
                      min={formTickerMinDate}
                      onChange={date => {
                        setForm(f => ({ ...f, dateAchat: date }))
                        if (form.ticker && date) {
                          setManuel(true)
                          fetchPrixAchatFor(form.ticker, form.devise, date)
                        }
                      }} />
                  )}
                </div>
              </div>
              {editId && groupHasSlices && (
                <p className="text-xs text-[#9E9A93] -mt-1">
                  La quantité et la date d'achat ne sont plus modifiables car cette position a déjà des ajouts ou réductions enregistrés.
                </p>
              )}

              {/* Status des fetches automatiques */}
              {(fetchingAchat || fetchingModal) && (
                <div className="flex items-center gap-2 text-xs text-[#9E9A93]">
                  <span className="animate-spin inline-block">⟳</span>
                  {fetchingAchat && fetchingModal ? 'Récupération des prix…' : fetchingAchat ? 'Prix d\'achat en cours…' : 'Prix actuel en cours…'}
                </div>
              )}
              {fetchModalError && <p className="text-xs text-red-500">{fetchModalError}</p>}

              {/* Toggle manuel */}
              <button type="button" onClick={() => setManuel(m => !m)}
                className="text-xs text-[#9E9A93] hover:text-[#5C6880] underline underline-offset-2 transition-colors">
                {manuel ? '▲ Masquer les champs manuels' : '▼ Remplir manuellement'}
              </button>

              {/* Champs manuels */}
              {manuel && (
                <div className="border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm p-4 space-y-4 bg-[#F5F3EF]/50 dark:bg-[#181C22]/50">
                  <p className="text-xs text-[#9E9A93]">Ces champs sont remplis automatiquement. Modifiez-les si nécessaire ou si l'actif n'est pas trouvé.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix d'achat ({form.devise})</label>
                      <input className={inputCls} type="number" step="any" placeholder="150.00" value={form.prixAchat || ''} onChange={fld('prixAchat')} />
                    </div>
                    {form.devise !== 'CHF' && (
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} à l'achat</label>
                        <input className={inputCls} type="number" step="0.0001" placeholder="0.9200" value={form.tauxAchatCHF || ''} onChange={fld('tauxAchatCHF')} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix actuel ({form.devise})</label>
                      <input className={inputCls} type="number" step="any" placeholder="185.00" value={form.prixActuel || ''} onChange={fld('prixActuel')} />
                    </div>
                    {form.devise !== 'CHF' && (
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} actuel</label>
                        <input className={inputCls} type="number" step="0.0001" placeholder="0.8800" value={form.tauxActuelCHF || ''} onChange={fld('tauxActuelCHF')} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Nom de l'actif</label>
                      <input className={inputCls} type="text" placeholder="Apple Inc." value={form.nom} onChange={fld('nom')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Ticker</label>
                      <input className={inputCls} type="text" placeholder="AAPL" value={form.ticker} onChange={fld('ticker')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Devise</label>
                      <select className={inputCls} value={form.devise} onChange={e => {
                        const devise = e.target.value
                        setForm(f => ({ ...f, devise }))
                        if (form.ticker) {
                          fetchPrixActuelFor(form.ticker, devise)
                          if (form.dateAchat) fetchPrixAchatFor(form.ticker, devise, form.dateAchat)
                        }
                      }}>
                        {DEVISES.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tranche (mode édition uniquement) */}
              {editId && (
                <div className="border border-[#DDD9D1] dark:border-[#323B4A] rounded-sm p-4 bg-[#F5F3EF]/30 dark:bg-[#181C22]/30 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={sliceMode} onChange={e => setSliceMode(e.target.checked)}
                      className="w-4 h-4 accent-[#14B8A6]" />
                    <span className="text-xs font-medium text-[#5C6880] dark:text-[#A8B8C8]">
                      Ajouter un lot / Ajuster la quantité
                      <span className="ml-1 font-normal text-[#9E9A93]">(historique conservé, performance par lot)</span>
                    </span>
                  </label>
                  {sliceMode && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-[#9E9A93]">
                        {sliceQuantite > 0 && sliceQuantite > sliceGroupTotal
                          ? `Un nouveau lot (+${(sliceQuantite - sliceGroupTotal).toFixed(sliceGroupTotal % 1 === 0 ? 0 : 4)} ${form.ticker}) sera ajouté avec son propre prix d'achat. La performance sera calculée depuis sa date d'achat.`
                          : "Une entrée de réduction sera ajoutée pour que le total du groupe reflète la nouvelle quantité. L'entrée originale reste inchangée."
                        }
                      </p>
                      <div className="grid grid-cols-2 gap-3 items-start">
                        <div>
                          <label className="block text-xs font-medium text-[#5C6880] mb-1">Date du changement</label>
                          <FormDatePicker
                            value={sliceDate}
                            min={form.dateAchat || undefined}
                            onChange={setSliceDate} />
                          {form.dateAchat && sliceDate && sliceDate < form.dateAchat ? (
                            <p className="text-xs mt-1 text-red-500 font-medium">La date ne peut pas être antérieure à l'ouverture ({form.dateAchat})</p>
                          ) : form.dateAchat ? (
                            <p className="text-xs mt-1 text-[#9E9A93]">≥ date d'ouverture ({form.dateAchat})</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#5C6880] mb-1">Nouvelle quantité totale</label>
                          <input
                            className={inputCls}
                            type="text"
                            inputMode="decimal"
                            placeholder={String(sliceGroupTotal)}
                            value={sliceQuantiteRaw}
                            onChange={e => {
                              const raw = e.target.value
                              if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                setSliceQuantiteRaw(raw)
                                const num = parseFloat(raw.replace(',', '.'))
                                if (!isNaN(num)) setSliceQuantite(num)
                                else if (raw === '') setSliceQuantite(0)
                              }
                            }}
                          />
                          <p className="text-xs mt-1 text-[#9E9A93]">Total groupe actuel : {sliceGroupTotal}</p>
                          {sliceQuantite > 0 && sliceQuantite !== sliceGroupTotal && (
                            <p className="text-xs mt-1 text-[#14B8A6]">
                              {sliceQuantite > sliceGroupTotal ? `Nouveau lot : +${sliceQuantite - sliceGroupTotal} ${form.ticker}` : `Réduction : ${sliceQuantite - sliceGroupTotal} ${form.ticker}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">
                          {sliceQuantite > sliceGroupTotal ? "Prix d'achat du lot" : "Prix de vente effectif"}
                          <span className="ml-1 text-[#9E9A93] font-normal">({form.devise})</span>
                        </label>
                        <div className="relative">
                          <input
                            className={inputCls}
                            type="text"
                            inputMode="decimal"
                            placeholder={
                              sliceHistoLoading ? 'Chargement...' :
                              sliceHistoPrice ? sliceHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 }) :
                              sliceDate ? 'Introuvable' :
                              form.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })
                            }
                            value={slicePrixVenteRaw}
                            onChange={e => {
                              const raw = e.target.value
                              if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                setSlicePrixVenteRaw(raw)
                                const num = parseFloat(raw.replace(',', '.'))
                                if (!isNaN(num) && num > 0) setSlicePrixVente(num)
                                else setSlicePrixVente(undefined)
                              }
                            }}
                          />
                          {sliceHistoLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93] animate-pulse">…</span>
                          )}
                        </div>
                        {sliceHistoPrice && !sliceHistoLoading && (
                          <p className="text-xs mt-1 text-[#14B8A6]">
                            {sliceQuantite > sliceGroupTotal ? "Prix d'achat suggéré" : "Prix de vente"} au {sliceDate} : {sliceHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {form.devise}
                            {form.devise !== 'CHF' && ` · Taux CHF : ${sliceHistoPrice.fxRate.toFixed(4)}`}
                          </p>
                        )}
                        {!sliceHistoPrice && !sliceHistoLoading && sliceDate && (
                          <p className="text-xs mt-1 text-[#9E9A93]">Prix historique non disponible — saisir manuellement.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#323B4A] text-[#5C6880] text-sm py-2 rounded-sm hover:bg-[#F5F3EF] dark:hover:bg-[#253040] transition-colors">
                  Annuler
                </button>
                <button onClick={saveForm} disabled={(!form.ticker && !form.nom) || (sliceMode && !!sliceDate && !!form.dateAchat && sliceDate < form.dateAchat) || (!sliceMode && !(editId && groupHasSlices) && !(form.quantite > 0))}
                  className="flex-1 bg-[#14B8A6] hover:bg-[#225549] disabled:opacity-40 text-white text-sm py-2 rounded-sm transition-colors font-medium">
                  {editId ? (sliceMode ? "Créer l'ajustement" : 'Enregistrer') : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}

const formatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const format = (input: string) => {
  if (!input) {
    return ''
  }

  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return input
  }

  return formatter.format(date)
}

export const formatTime = (input: string | Date) => {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

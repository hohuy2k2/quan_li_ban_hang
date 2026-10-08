/** Định dạng số tiền theo đồng Việt Nam. */
export function money(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫'
}

/** Chuẩn hoá chữ có dấu để tìm sản phẩm bằng tiếng Việt không dấu. */
export function searchKey(value: string): string {
  return value.toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

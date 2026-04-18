export const formatAppointmentDateTime = (date: any, time: string) => {
    const dateObj = new Date(date);

    const vn = new Date(
        dateObj.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    );

    const year = vn.getFullYear();
    const month = String(vn.getMonth() + 1).padStart(2, '0');
    const day = String(vn.getDate()).padStart(2, '0');

    const combined = new Date(`${year}-${month}-${day}T${time}:59`);

    const hh = String(combined.getHours()).padStart(2, '0');
    const mm = String(combined.getMinutes()).padStart(2, '0');
    // const ss = String(combined.getSeconds()).padStart(2, '0');

    return `${hh}:${mm} ${day}/${month}/${year}`;
};
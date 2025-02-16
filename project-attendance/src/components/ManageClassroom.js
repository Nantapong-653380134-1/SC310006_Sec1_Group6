// src/ManageClassroom.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import QRCode from "qrcodejs2"; // ตรวจสอบว่าติดตั้ง qrcodejs2 ด้วย npm install qrcodejs2
import "../styles/ManageClassroom.css";

const ManageClassroom = () => {
  const { cid } = useParams();
  const [courseInfo, setCourseInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [checkinHistory, setCheckinHistory] = useState([]);

  // ดึงข้อมูลของห้องเรียน, รายชื่อนักเรียน และประวัติการเช็คชื่อ
  useEffect(() => {
    const fetchClassroomData = async () => {
      try {
        // ดึงข้อมูลรายละเอียดวิชา
        const classroomRef = doc(db, "classroom", cid);
        const classroomSnap = await getDoc(classroomRef);
        if (classroomSnap.exists()) {
          setCourseInfo(classroomSnap.data().info);
        }

        // ดึงรายชื่อนักเรียนที่ลงทะเบียน
        const studentsSnap = await getDocs(collection(db, "classroom", cid, "students"));
        const studentsData = [];
        studentsSnap.forEach((docSnap) => {
          studentsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        setStudents(studentsData);

        // ดึงประวัติการเช็คชื่อ โดยเรียงตามวันที่ล่าสุดก่อน
        const checkinQuery = query(
          collection(db, "classroom", cid, "checkin"),
          orderBy("date", "desc")
        );
        const checkinSnap = await getDocs(checkinQuery);
        const checkins = [];
        checkinSnap.forEach((docSnap) => {
          checkins.push({ cno: docSnap.id, ...docSnap.data() });
        });
        setCheckinHistory(checkins);
      } catch (error) {
        console.error("Error fetching classroom data:", error);
      }
    };

    fetchClassroomData();
  }, [cid]);

  // สร้าง QRCode โดยใช้ cid เป็นข้อความ
  const generateQRCode = () => {
    const qrcodeContainer = document.getElementById("qrcode");
    if (qrcodeContainer) {
      qrcodeContainer.innerHTML = "";
      new QRCode(qrcodeContainer, {
        text: cid,
        width: 128,
        height: 128,
      });
    }
  };

  // ฟังก์ชันเพิ่มการเช็คชื่อใหม่
  const handleAddCheckin = async () => {
    try {
      // สร้างเอกสารใหม่ใน subcollection checkin พร้อมส่ง field owner
      const checkinRef = await addDoc(collection(db, "classroom", cid, "checkin"), {
        code: "รหัสเช็คชื่อ", // สามารถปรับให้ generate รหัสหรือให้ผู้ใช้กรอกได้
        date: new Date(),
        status: 0,
        owner: auth.currentUser.uid,
      });
      const cno = checkinRef.id;
      // คัดลอกรายชื่อนักเรียนจาก /classroom/{cid}/students ไปยัง /classroom/{cid}/checkin/{cno}/scores โดยกำหนด status=0
      const studentsSnap = await getDocs(collection(db, "classroom", cid, "students"));
      studentsSnap.forEach(async (docSnap) => {
        await setDoc(
          doc(db, "classroom", cid, "checkin", cno, "scores", docSnap.id),
          {
            ...docSnap.data(),
            status: 0,
          }
        );
      });
      alert("เพิ่มการเช็คชื่อสำเร็จ");

      // Refresh ประวัติการเช็คชื่อ
      const checkinQuery = query(
        collection(db, "classroom", cid, "checkin"),
        orderBy("date", "desc")
      );
      const checkinSnap = await getDocs(checkinQuery);
      const checkins = [];
      checkinSnap.forEach((docSnap) => {
        checkins.push({ cno: docSnap.id, ...docSnap.data() });
      });
      setCheckinHistory(checkins);
    } catch (error) {
      console.error("Add checkin error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="manage-classroom-container">
      {courseInfo && (
        <div className="course-details">
          <h2>{courseInfo.name}</h2>
          <p>รหัสวิชา: {courseInfo.code}</p>
          <img src={courseInfo.photo} alt={courseInfo.name} className="course-bg" />
          <button onClick={generateQRCode} className="button">
            แสดง QRCode
          </button>
          <div id="qrcode"></div>
        </div>
      )}

      <h3>รายชื่อนักเรียนที่ลงทะเบียน</h3>
      <table className="students-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>รหัส</th>
            <th>ชื่อ</th>
            <th>รูปภาพ</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {students.length > 0 ? (
            students.map((s, index) => (
              <tr key={s.id}>
                <td>{index + 1}</td>
                <td>{s.stdid || s.id}</td>
                <td>{s.name}</td>
                <td>
                  {s.photo ? (
                    <img src={s.photo} alt={s.name} width="50" />
                  ) : (
                    "ไม่มี"
                  )}
                </td>
                <td>{s.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">ยังไม่มีนักเรียนลงทะเบียน</td>
            </tr>
          )}
        </tbody>
      </table>

      <button onClick={handleAddCheckin} className="button">
        เพิ่มการเช็คชื่อ
      </button>

      <h3>ประวัติการเช็คชื่อ</h3>
      <table className="checkin-history-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>วัน-เวลา</th>
            <th>จำนวนคนเข้าเรียน</th>
            <th>สถานะ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {checkinHistory.length > 0 ? (
            checkinHistory.map((checkin, index) => (
              <tr key={checkin.cno}>
                <td>{index + 1}</td>
                <td>{new Date(checkin.date.seconds * 1000).toLocaleString()}</td>
                <td>{checkin.count ? checkin.count : "-"}</td>
                <td>{checkin.status === 0 ? "กำลังเรียน" : "เสร็จสิ้น"}</td>
                <td>
                  <button className="button">เช็คเชื่อ</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">ยังไม่มีประวัติการเช็คชื่อ</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ManageClassroom;

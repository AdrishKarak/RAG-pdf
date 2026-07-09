'use client';
import {Upload} from 'lucide-react';
export default function FileUploadComponent() {

    const handlefileUpload = () => {
      const el = document.createElement('input');
      el.setAttribute('type', 'file');  
      el.setAttribute('accept', 'application/pdf');
      el.addEventListener('change', async (ev) => {
        if(el.files && el.files.length > 0) {
            const file = el.files.item(0);
            if(file){
              const formdata = new FormData();
              formdata.append('pdf', file);

             await fetch('http://localhost:8000/upload/pdf' , {
                method: 'POST',
                body: formdata
              });
            }
        }
      });
      el.click();
    }

  return (
    <div className='bg-slate-900 text-white shadow-2xl flex justify-center items-center p-4 rounded-lg border border-white'>
    <div onClick={handlefileUpload} className='flex flex-col justify-center items-center gap-4'>
      <Upload className='w-6 h-6'/>
      <p className='text-xl font-semibold'>Upload PDF File</p>
    </div>
    </div>
  );
}
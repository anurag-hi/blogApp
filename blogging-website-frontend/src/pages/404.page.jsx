import pageNotFoundImage from "../imgs/404.png"

const PageNotFound = ()=>{
    return (

        <section className="h-cover relative p-10 flex flex-col items-center gap-20 text-center">

            <img src={pageNotFoundImage} className="select-none border-2 border-grey w-72 aspect-square object-cover rounded"/>
                <h1 className="text-4xl font-gelasio leading-7">Page Not Found</h1>

        </section>

    )
}

export default PageNotFound;